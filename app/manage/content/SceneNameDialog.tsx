"use client";

import { useId, useState, type FormEvent, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ContentFailureNotice } from "./ContentFeedback";
import { useContentAction } from "./useContentAction";
import type { ContentActionResult } from "./types";

export const SCENE_NAME_MAX = 80;

export interface SceneNameDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  submitLabel: string;
  initialName?: string;
  /** Extra fields rendered between the name and the footer. */
  children?: ReactNode;
  onSubmit: (name: string) => Promise<ContentActionResult | void>;
}

/** Shared name form for creating and copying scenes. */
export function SceneNameDialog({ open, onOpenChange, title, description, submitLabel, initialName = "", children, onSubmit }: SceneNameDialogProps) {
  const { t } = useTranslation();
  const id = useId();
  const [name, setName] = useState(initialName);
  const action = useContentAction();
  // Reset the form each time the dialog opens, during render rather than in an effect.
  const [openedWith, setOpenedWith] = useState<string | null>(open ? initialName : null);
  const openKey = open ? initialName : null;
  if (openKey !== openedWith) {
    setOpenedWith(openKey);
    if (open) { setName(initialName); action.reset(); }
  }

  const close = (next: boolean) => {
    if (!action.pending) onOpenChange(next);
  };
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const trimmed = name.trim();
    if (trimmed && (await action.run(() => onSubmit(trimmed)))) onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent>
        <form onSubmit={submit} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor={id}>{t("contentModel.scene.name")}</Label>
            <Input id={id} value={name} onChange={(event) => setName(event.target.value)} maxLength={SCENE_NAME_MAX} disabled={action.pending} autoFocus required />
          </div>
          {children}
          {action.failure && <ContentFailureNotice failure={action.failure} />}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => close(false)} disabled={action.pending}>{t("contentModel.action.cancel")}</Button>
            <Button type="submit" disabled={!name.trim() || action.pending}>
              {action.pending && <Loader2 className="animate-spin" aria-hidden />}
              {submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
