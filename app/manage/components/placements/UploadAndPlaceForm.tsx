"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Text } from "@/components/ui/typography";
import { getLinkAssetErrorKey, parseLinkAssetInput } from "@/lib/link-asset";
import type { UploadType } from "@/lib/upload/types";
import { Camera, Loader2 } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { acceptFor, fileTypeOf, linkPayload, prepareFile, textPayload, uploadFileVersion, type PreparedFile, type UploadedVersionInput } from "../../lib/content-upload";
import { usePlacementStore } from "../../lib/placement-store";
import { FieldLabel } from "../AssetEditor/FieldLabel";
import { AssetLinkPreview } from "../AssetEditor/previews/AssetLinkPreview";
import { FileDropzone } from "../upload/file-dropzone";
import { FileTypeSelector } from "../upload/file-type-selector";
import { PlacementLocationFields } from "./PlacementLocationFields";
import { usePlacementMap } from "./PlacementMapContext";
import { EMPTY_LOCATION, locationFromCapture, parseLocation, useCreatePlacement, type LocationInput } from "./useCreatePlacement";

const PLACEABLE: UploadType[] = ["image", "video", "audio", "model", "document", "text", "link", "anchor"];

/**
 * "Upload and place": one server command creates the asset, its v1 and an
 * active placement at the explicitly chosen location. Photo GPS is capture
 * provenance; it becomes the location only through "use photo GPS".
 */
export function UploadAndPlaceForm() {
  const { t } = useTranslation();
  const { tx, organizationId, workspaceId, allowedUploadTypes } = usePlacementMap();
  const types = useMemo(() => PLACEABLE.filter((type) => allowedUploadTypes.includes(type)), [allowedUploadTypes]);
  const create = useCreatePlacement();
  // The open editor above owns the primary action; creation steps back to secondary.
  const editorOpen = usePlacementStore((state) => !!(state.selectedPlacementId || state.selectedAnchorId));
  const [type, setType] = useState<UploadType>(types[0] ?? "image");
  const [file, setFile] = useState<File | null>(null);
  const [prepared, setPrepared] = useState<PreparedFile | null>(null);
  const [preparing, setPreparing] = useState(false);
  const [text, setText] = useState("");
  const [link, setLink] = useState("");
  const [name, setName] = useState("");
  const [location, setLocation] = useState<LocationInput>(EMPTY_LOCATION);
  const [problem, setProblem] = useState<string | null>(null);
  // Same file + same intent → reuse the receipt so a retry replays an identical body.
  const uploaded = useRef<{ source: PreparedFile; input: UploadedVersionInput } | null>(null);

  const linkState = useMemo(() => {
    if (type !== "link" || !link.trim()) return { data: null, errorKey: null };
    try {
      return { data: parseLinkAssetInput(link), errorKey: null };
    } catch (error) {
      return { data: null, errorKey: getLinkAssetErrorKey(error) };
    }
  }, [type, link]);

  const reset = () => {
    setFile(null);
    setPrepared(null);
    setText("");
    setLink("");
    setName("");
    setLocation(EMPTY_LOCATION);
    uploaded.current = null;
    create.resetIntent();
  };

  const selectFile = async (next: File) => {
    setFile(next);
    setPrepared(null);
    setProblem(null);
    create.resetIntent();
    setPreparing(true);
    try {
      setPrepared(await prepareFile(next, type));
    } catch (error) {
      setProblem(error instanceof Error ? error.message : String(error));
    } finally {
      setPreparing(false);
    }
  };

  const photoLocation = locationFromCapture(prepared?.capture);
  const isFile = type !== "text" && type !== "link";

  const submit = async () => {
    setProblem(null);
    const point = parseLocation(location);
    if (point === "invalid") return setProblem(tx("contentModel.integration.map.problem.coordinates"));
    if (!point) return setProblem(tx("contentModel.integration.map.create.locationRequired"));
    if (isFile && !prepared) return setProblem(tx("contentModel.integration.map.create.fileRequired"));
    if (type === "text" && !text.trim()) return setProblem(tx("contentModel.integration.map.create.textRequired"));
    if (type === "link" && !linkState.data) return setProblem(linkState.errorKey ? t(linkState.errorKey) : tx("contentModel.integration.map.create.linkRequired"));
    const assetName = name.trim() || (isFile ? file?.name ?? "" : type === "text" ? text.trim().slice(0, 40) : linkState.data?.originalUrl ?? "");

    const created = await create.submit(async () => {
      if (type === "text") return { asset: { name: assetName, fileType: "text", payload: textPayload(text.trim()), resources: [] }, name: name.trim() || undefined, location: point, status: "active" };
      if (type === "link") return { asset: { name: assetName, fileType: "link", payload: linkPayload(linkState.data!, name.trim() || undefined), resources: [] }, name: name.trim() || undefined, location: point, status: "active" };
      if (!uploaded.current || uploaded.current.source !== prepared) {
        uploaded.current = { source: prepared!, input: await uploadFileVersion(prepared!, { organizationId, workspaceId }) };
      }
      const { payload, resources } = uploaded.current.input;
      return { asset: { name: assetName, fileType: fileTypeOf(prepared!.type), payload, resources }, name: name.trim() || undefined, location: point, status: "active" };
    });
    if (created) reset();
  };

  return (
    <div className="space-y-4">
      <FileTypeSelector selectedType={type} types={types} onTypeChange={(next) => { setType(next); reset(); }} />
      {isFile && <FileDropzone file={file} accept={acceptFor(type)} onFileSelect={(next) => void selectFile(next)} onFileRemove={() => { setFile(null); setPrepared(null); uploaded.current = null; }} disabled={create.pending} />}
      {preparing && <Text as="p" variant="bodySm" tone="subdued">{tx("contentModel.integration.map.create.preparing")}</Text>}
      {type === "text" && (
        <div className="space-y-1">
          <FieldLabel htmlFor="upload-place-text">{tx("contentModel.integration.map.create.text")}</FieldLabel>
          <Textarea id="upload-place-text" rows={4} value={text} onChange={(event) => setText(event.target.value)} />
        </div>
      )}
      {type === "link" && (
        <div className="space-y-2">
          <FieldLabel htmlFor="upload-place-link">{tx("contentModel.integration.map.create.link")}</FieldLabel>
          <Input id="upload-place-link" value={link} placeholder="https://" onChange={(event) => setLink(event.target.value)} />
          {linkState.data && <AssetLinkPreview linkData={linkState.data} compact />}
        </div>
      )}
      <div className="space-y-1">
        <FieldLabel htmlFor="upload-place-name">{tx("contentModel.integration.map.field.name")}</FieldLabel>
        <Input id="upload-place-name" value={name} placeholder={tx("contentModel.integration.map.create.namePlaceholder")} onChange={(event) => setName(event.target.value)} />
      </div>
      <PlacementLocationFields
        {...location}
        disabled={false}
        onChange={(patch) => setLocation((current) => ({ ...current, ...patch }))}
        extraAction={photoLocation && (
          <Button type="button" variant="outline" size="sm" onClick={() => setLocation(photoLocation)}>
            <Camera className="size-4" aria-hidden />
            {tx("contentModel.integration.map.field.usePhotoGps")}
          </Button>
        )}
      />
      {(problem || create.error) && <Text as="p" variant="bodySm" tone="critical" role="alert">{problem ?? create.error}</Text>}
      <Button className="w-full" variant={editorOpen ? "secondary" : "default"} onClick={submit} disabled={create.pending || preparing}>
        {create.pending && <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden />}
        {tx("contentModel.integration.map.create.uploadAction")}
      </Button>
    </div>
  );
}
