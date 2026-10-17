"use client";

import { useCallback, useRef, useState } from "react";
import type { AssetFileType, AssetVersionPayload, ResourceInput } from "@/lib/content-model/contracts";
import { isContentApiError, newIdempotencyKey, workspaceApi } from "@/app/manage/lib/content-api";
import { errorMessage } from "@/app/manage/lib/content-errors";
import { fileTypeOf, prepareFile, textPayload, uploadFileVersion } from "@/app/manage/lib/content-upload";
import type { IntegrationT } from "@/app/manage/lib/integration-text";
import type { ConfirmedLocation } from "../components/LocationConfirm";
import type { OnsiteReceipt } from "../components/UploadReceiptCard";

/** One capture as handed over by CameraUpload / AudioRecorder / TextUpload. */
export type OnsiteCapture =
  | { kind: "image"; source: string; title?: string; description?: string }
  | { kind: "audio"; source: File; title?: string; description?: string }
  | { kind: "text"; source: string };

export interface OnsiteTarget {
  organizationId: string | null;
  /** Map collection (workspace UUID) the capture is placed in. */
  workspaceId: string | null;
  collectionName: string | null;
  canEdit: boolean;
  location: ConfirmedLocation | null;
  tagIds: string[];
}

interface Attempt {
  source: string | File;
  fingerprint: string;
  key: string;
  defaultName: string;
}

interface UploadedFile {
  source: string | File;
  workspaceId: string;
  fileType: AssetFileType;
  payload: AssetVersionPayload;
  resources: ResourceInput[];
}

async function dataUrlToFile(dataUrl: string) {
  const blob = await (await fetch(dataUrl)).blob();
  return new File([blob], `onsite-${Date.now()}.jpg`, { type: blob.type || "image/jpeg" });
}

function withDescription(payload: AssetVersionPayload, description?: string): AssetVersionPayload {
  const text = description?.trim();
  if (!text) return payload;
  return { ...payload, attributes: { ...(payload.attributes ?? {}), description: text } };
}

function captureTime() {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
}

/**
 * v2 "upload and place" in one server command. The idempotency key and the
 * upload receipt are kept while the same capture is retried with the same
 * inputs, so a lost response never creates a second asset; any change of
 * capture, collection, location, tags or text starts a new intent.
 */
export function useOnsitePlacement(target: OnsiteTarget, tx: IntegrationT) {
  const [receipt, setReceipt] = useState<OnsiteReceipt | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const attemptRef = useRef<Attempt | null>(null);
  const uploadRef = useRef<UploadedFile | null>(null);

  const submit = useCallback(async (capture: OnsiteCapture) => {
    const { organizationId, workspaceId, location, canEdit, tagIds } = target;
    if (!organizationId || !workspaceId || !location || !canEdit) {
      const message = tx("contentModel.integration.onsite.missing");
      setFailure(message);
      throw new Error(message);
    }
    const title = capture.kind === "text" ? undefined : capture.title?.trim() || undefined;
    const description = capture.kind === "text" ? undefined : capture.description?.trim() || undefined;
    const point = { longitude: location.longitude, latitude: location.latitude, altitude: location.altitude };
    const fingerprint = JSON.stringify({ workspaceId, kind: capture.kind, title, description, point, tagIds });

    let attempt = attemptRef.current;
    if (!attempt || attempt.source !== capture.source) {
      const label = tx(`contentModel.integration.onsite.defaultName.${capture.kind}`);
      attempt = { source: capture.source, fingerprint, key: newIdempotencyKey(), defaultName: `${label} ${captureTime()}` };
    } else if (attempt.fingerprint !== fingerprint) {
      attempt = { ...attempt, fingerprint, key: newIdempotencyKey() };
    }
    attemptRef.current = attempt;

    setSubmitting(true);
    setFailure(null);
    setReceipt(null);
    try {
      let fileType: AssetFileType = "text";
      let payload: AssetVersionPayload;
      let resources: ResourceInput[] = [];
      if (capture.kind === "text") {
        payload = textPayload(capture.source);
      } else {
        let uploaded = uploadRef.current;
        if (!uploaded || uploaded.source !== capture.source || uploaded.workspaceId !== workspaceId) {
          const file = capture.kind === "image" ? await dataUrlToFile(capture.source) : capture.source;
          const prepared = await prepareFile(file, capture.kind);
          const version = await uploadFileVersion(prepared, { organizationId, workspaceId });
          uploaded = { source: capture.source, workspaceId, fileType: fileTypeOf(prepared.type), payload: version.payload, resources: version.resources };
          uploadRef.current = uploaded;
        }
        fileType = uploaded.fileType;
        payload = withDescription(uploaded.payload, description);
        resources = uploaded.resources;
      }
      const textName = capture.kind === "text" ? capture.source.trim().split("\n")[0].slice(0, 30).trim() : "";
      const name = title || textName || attempt.defaultName;
      const result = await workspaceApi.createPlacement(workspaceId, {
        asset: { name, fileType, payload, resources },
        name,
        location: point,
        status: "active",
        ...(tagIds.length > 0 ? { tagIds } : {}),
        idempotencyKey: attempt.key,
      });
      attemptRef.current = null;
      uploadRef.current = null;
      setReceipt({ result, organizationId, workspaceId, collectionName: target.collectionName, submittedLocation: point });
    } catch (error) {
      let message = errorMessage(error, tx);
      if (isContentApiError(error) && error.code === "IDEMPOTENCY_CONFLICT") {
        attemptRef.current = null;
        message = tx("contentModel.integration.onsite.error.idempotency");
      } else if (isContentApiError(error) && error.code === "RECEIPT_INVALID") {
        attemptRef.current = null;
        uploadRef.current = null;
        message = `${message} ${tx("contentModel.integration.onsite.error.receipt")}`;
      }
      setFailure(message);
      throw error instanceof Error ? error : new Error(message);
    } finally {
      setSubmitting(false);
    }
  }, [target, tx]);

  return { submit, receipt, failure, submitting, dismissReceipt: () => setReceipt(null), dismissFailure: () => setFailure(null) };
}
