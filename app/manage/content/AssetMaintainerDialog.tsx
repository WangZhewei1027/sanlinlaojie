"use client";

import { useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ContentFailureNotice } from "./ContentFeedback";
import { useContentAction } from "./useContentAction";
import type { ContentAction, ContentPerson } from "./types";

export interface AssetMaintainerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  assetName: string;
  currentMaintainer: ContentPerson | null;
  /** Writable members of the asset's organization. */
  candidates: ContentPerson[];
  onTransfer: ContentAction<[personId: string]>;
}

export function AssetMaintainerDialog({ open, onOpenChange, assetName, currentMaintainer, candidates, onTransfer }: AssetMaintainerDialogProps) {
  const { t } = useTranslation();
  const id = useId();
  const [personId, setPersonId] = useState("");
  const action = useContentAction();
  const options = candidates.filter((person) => person.id !== currentMaintainer?.id);

  const close = (next: boolean) => {
    if (action.pending) return;
    if (!next) { setPersonId(""); action.reset(); }
    onOpenChange(next);
  };
  const submit = async () => {
    if (personId && (await action.run(() => onTransfer(personId)))) close(false);
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("contentModel.maintenance.transferTitle")}</DialogTitle>
          <DialogDescription>
            {t("contentModel.maintenance.transferBody", { name: assetName, current: currentMaintainer?.name ?? t("contentModel.library.noMaintainerShort") })}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor={id}>{t("contentModel.maintenance.newMaintainer")}</Label>
          <Select value={personId} onValueChange={setPersonId} disabled={action.pending || !options.length}>
            <SelectTrigger id={id} className="w-full">
              <SelectValue placeholder={options.length ? t("contentModel.maintenance.choosePerson") : t("contentModel.maintenance.noCandidates")} />
            </SelectTrigger>
            <SelectContent>
              {options.map((person) => <SelectItem key={person.id} value={person.id}>{person.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        {action.failure && <ContentFailureNotice failure={action.failure} />}
        <DialogFooter>
          <Button variant="outline" onClick={() => close(false)} disabled={action.pending}>{t("contentModel.action.cancel")}</Button>
          <Button onClick={submit} disabled={!personId || action.pending}>
            {action.pending && <Loader2 className="animate-spin" aria-hidden />}
            {t("contentModel.maintenance.transferAction")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
