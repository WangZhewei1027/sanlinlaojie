"use client";

import { useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Text } from "@/components/ui/typography";
import type { ResourceInput } from "@/lib/content-model/contracts";
import { FieldLabel } from "../AssetEditor/FieldLabel";
import { FileDropzone } from "../upload/file-dropzone";
import { uploadReceipt } from "../../lib/content-api";
import { acceptFor, prepareFile } from "../../lib/content-upload";
import { usePlacementStore } from "../../lib/placement-store";
import { usePlacementMap } from "./PlacementMapContext";
import { PlacementLocationFields } from "./PlacementLocationFields";
import { EMPTY_LOCATION, parseLocation, useCreatePlacement, type LocationInput } from "./useCreatePlacement";

/**
 * Shop upload keeps its dedicated form: primary image, optional check-in
 * photo (resource role "checkin"), name and description. Shops are the one
 * type that may be created without a location (directory-only placement).
 */
export function ShopPlaceForm() {
  const { tx, workspaceId } = usePlacementMap();
  const create = useCreatePlacement();
  // The open editor above owns the primary action; creation steps back to secondary.
  const editorOpen = usePlacementStore((state) => !!(state.selectedPlacementId || state.selectedAnchorId));
  const [image, setImage] = useState<File | null>(null);
  const [checkin, setCheckin] = useState<File | null>(null);
  const [name, setName] = useState("");
  const [text, setText] = useState("");
  const [location, setLocation] = useState<LocationInput>(EMPTY_LOCATION);
  const [problem, setProblem] = useState<string | null>(null);
  // Receipts per selected file, reused on retry so the replayed body is identical.
  const receipts = useRef(new Map<File, string>());

  const receiptFor = async (file: File) => {
    const known = receipts.current.get(file);
    if (known) return known;
    const prepared = await prepareFile(file, "shop");
    const receipt = await uploadReceipt(prepared.file, { type: "shop", workspaceId: workspaceId! });
    receipts.current.set(file, receipt.id);
    return receipt.id;
  };

  const changed = <T,>(setter: (value: T) => void) => (value: T) => {
    setter(value);
    create.resetIntent();
  };

  const submit = async () => {
    setProblem(null);
    if (!image) return setProblem(tx("contentModel.integration.map.create.fileRequired"));
    if (!name.trim()) return setProblem(tx("contentModel.integration.map.shop.nameRequired"));
    const point = parseLocation(location);
    if (point === "invalid") return setProblem(tx("contentModel.integration.map.problem.coordinates"));
    const created = await create.submit(async () => {
      const resources: ResourceInput[] = [{ role: "primary", receiptId: await receiptFor(image) }];
      if (checkin) resources.push({ role: "checkin", receiptId: await receiptFor(checkin) });
      return {
        asset: { name: name.trim(), fileType: "shop", payload: { kind: "shop", name: name.trim(), ...(text.trim() ? { text: text.trim() } : {}) }, resources },
        name: name.trim(),
        location: point,
        status: "active",
      };
    });
    if (created) {
      setImage(null);
      setCheckin(null);
      setName("");
      setText("");
      setLocation(EMPTY_LOCATION);
      receipts.current.clear();
    }
  };

  return (
    <div className="space-y-4">
      <FileDropzone file={image} accept={acceptFor("shop")} label={tx("contentModel.integration.map.shop.image")} onFileSelect={changed(setImage)} onFileRemove={() => changed(setImage)(null)} disabled={create.pending} />
      <FileDropzone file={checkin} accept={acceptFor("shop")} label={tx("contentModel.integration.map.shop.checkinOptional")} onFileSelect={changed(setCheckin)} onFileRemove={() => changed(setCheckin)(null)} disabled={create.pending} />
      <div className="space-y-1">
        <FieldLabel htmlFor="shop-place-name">{tx("contentModel.integration.map.shop.name")}</FieldLabel>
        <Input id="shop-place-name" value={name} onChange={(event) => changed(setName)(event.target.value)} />
      </div>
      <div className="space-y-1">
        <FieldLabel htmlFor="shop-place-text">{tx("contentModel.integration.map.shop.description")}</FieldLabel>
        <Textarea id="shop-place-text" rows={3} value={text} onChange={(event) => changed(setText)(event.target.value)} />
      </div>
      <PlacementLocationFields {...location} disabled={false} onChange={(patch) => setLocation((current) => ({ ...current, ...patch }))} />
      <Text as="p" variant="bodySm" tone="subdued">{tx("contentModel.integration.map.shop.locationOptional")}</Text>
      {(problem || create.error) && <Text as="p" variant="bodySm" tone="critical" role="alert">{problem ?? create.error}</Text>}
      <Button className="w-full" variant={editorOpen ? "secondary" : "default"} onClick={submit} disabled={create.pending}>
        {create.pending && <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden />}
        {tx("contentModel.integration.map.shop.createAction")}
      </Button>
    </div>
  );
}
