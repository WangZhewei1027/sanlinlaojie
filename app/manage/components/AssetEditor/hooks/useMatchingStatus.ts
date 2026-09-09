"use client";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { MatchingStatus } from "../matching-point-types";

const serverStatuses = new Set(["missing_image", "pending", "ready", "failed", "unconfigured", "processing"]);

/** Poll only unsettled features; never let an old request overwrite a new image or rebuild. */
export function useMatchingStatus(assetId: string, imageUrl: string | null, isSaving: boolean) {
  const { t } = useTranslation();
  const [state, setState] = useState<{ status: MatchingStatus; updatedAt: string | null; error: string | null }>({
    status: "loading", updatedAt: null, error: null,
  });
  const [request, setRequest] = useState({ revision: 0, generate: false });
  const consumedRequest = useRef(request);
  useEffect(() => {
    if (isSaving) return;
    const generate = request.generate && consumedRequest.current !== request;
    consumedRequest.current = request;
    const controller = new AbortController();
    let disposed = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const deadline = Date.now() + 120_000;
    setState({ status: generate ? "processing" : "loading", updatedAt: null, error: null });
    async function read(method: "GET" | "POST") {
      const timeout = setTimeout(() => controller.abort("timeout"), method === "POST" ? 65_000 : 15_000);
      try {
        const response = await fetch(`/api/assets/${assetId}/matching`, {
          method, signal: controller.signal, cache: "no-store",
        });
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || t("matching.loadFailed"));
        if (!serverStatuses.has(body.data?.status)) throw new Error(t("matching.loadFailed"));
        return body.data as { status: MatchingStatus; updated_at?: string };
      } finally {
        clearTimeout(timeout);
      }
    }
    async function refresh(generate: boolean) {
      let phase: "generate" | "read" = generate ? "generate" : "read";
      try {
        if (generate) {
          await read("POST");
          if (controller.signal.aborted) return;
          phase = "read";
        }
        const data = await read("GET");
        if (controller.signal.aborted) return;
        setState({ status: data.status, updatedAt: data.updated_at || null, error: null });
        if ((data.status === "pending" || data.status === "processing") && Date.now() < deadline) {
          timer = setTimeout(() => void refresh(false), 3000);
        }
      } catch (error) {
        if (disposed || (controller.signal.aborted && controller.signal.reason !== "timeout")) return;
        setState({
          status: phase === "generate" && !controller.signal.aborted && !(error instanceof TypeError) ? "failed" : "status_error", updatedAt: null,
          error: controller.signal.reason === "timeout"
            ? t("matching.requestTimeout")
            : error instanceof Error ? error.message : t("matching.loadFailed"),
        });
      }
    }
    void refresh(generate);
    return () => { disposed = true; controller.abort(); clearTimeout(timer); };
  }, [assetId, imageUrl, isSaving, request, t]);
  return {
    ...state,
    rebuild: () => setRequest((value) => ({ revision: value.revision + 1, generate: true })),
    refresh: () => setRequest((value) => ({ revision: value.revision + 1, generate: false })),
  };
}
