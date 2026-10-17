"use client";

import { useId, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ContentFailureNotice } from "./ContentFeedback";
import { useContentAction } from "./useContentAction";
import type { CollectionInput, CollectionItem, ContentAction } from "./types";

export const COLLECTION_NAME_MAX = 60;
const DESCRIPTION_MAX = 200;

export interface CollectionFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Present when editing; absent when creating. */
  collection?: CollectionItem | null;
  onSubmit: ContentAction<[input: CollectionInput]>;
}

/** Name and optional description of a map collection. */
export function CollectionFormDialog({ open, onOpenChange, collection, onSubmit }: CollectionFormDialogProps) {
  const { t } = useTranslation();
  const ids = { name: useId(), description: useId() };
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const action = useContentAction();
  // Reset each time the dialog opens, during render rather than in an effect.
  const openKey = open ? collection?.id ?? "new" : null;
  const [openedFor, setOpenedFor] = useState<string | null>(null);
  if (openKey !== openedFor) {
    setOpenedFor(openKey);
    if (open) { setName(collection?.name ?? ""); setDescription(collection?.description ?? ""); action.reset(); }
  }
  const editing = !!collection;

  const close = (next: boolean) => { if (!action.pending) onOpenChange(next); };
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const trimmed = name.trim();
    if (trimmed && (await action.run(() => onSubmit({ name: trimmed, description: description.trim() })))) onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent>
        <form onSubmit={submit} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>{t(editing ? "contentModel.collections.editTitle" : "contentModel.collections.createTitle")}</DialogTitle>
            <DialogDescription>{t(editing ? "contentModel.collections.editBody" : "contentModel.collections.createBody")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor={ids.name}>{t("contentModel.collections.name")}</Label>
            <Input id={ids.name} value={name} onChange={(event) => setName(event.target.value)} maxLength={COLLECTION_NAME_MAX} disabled={action.pending} autoFocus required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={ids.description}>{t("contentModel.collections.description")}</Label>
            <Textarea id={ids.description} value={description} onChange={(event) => setDescription(event.target.value)} maxLength={DESCRIPTION_MAX} rows={3} disabled={action.pending} />
          </div>
          {action.failure && <ContentFailureNotice failure={action.failure} />}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => close(false)} disabled={action.pending}>{t("contentModel.action.cancel")}</Button>
            <Button type="submit" disabled={!name.trim() || action.pending}>
              {action.pending && <Loader2 className="animate-spin" aria-hidden />}
              {t(editing ? "contentModel.collections.save" : "contentModel.collections.createAction")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
