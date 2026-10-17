"use client";

import { useId, useState, type FormEvent, type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ContentFailureNotice, useContentAction, type ContentActionResult } from "@/app/manage/content";

const NAME_MAX = 120;

export interface AssetNameDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  nameLabel: string;
  submitLabel: string;
  cancelLabel: string;
  initialName: string;
  /** Extra fields between the name and the footer. */
  children?: ReactNode;
  /** Extra condition for enabling submit (e.g. target project checked). */
  canSubmit?: boolean;
  onSubmit: (name: string) => Promise<ContentActionResult | void>;
}

/** Name form shared by rename and "save as copy". */
export function AssetNameDialog(props: AssetNameDialogProps) {
  const id = useId();
  const [name, setName] = useState(props.initialName);
  const action = useContentAction();
  // Reset each time the dialog opens, during render rather than in an effect.
  const openKey = props.open ? props.initialName : null;
  const [openedWith, setOpenedWith] = useState<string | null>(openKey);
  if (openKey !== openedWith) {
    setOpenedWith(openKey);
    if (props.open) { setName(props.initialName); action.reset(); }
  }

  const close = (next: boolean) => {
    if (!action.pending) props.onOpenChange(next);
  };
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const trimmed = name.trim();
    if (trimmed && (await action.run(() => props.onSubmit(trimmed)))) props.onOpenChange(false);
  };

  return (
    <Dialog open={props.open} onOpenChange={close}>
      <DialogContent>
        <form onSubmit={submit} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>{props.title}</DialogTitle>
            <DialogDescription>{props.description}</DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor={id}>{props.nameLabel}</Label>
            <Input id={id} value={name} onChange={(event) => setName(event.target.value)} maxLength={NAME_MAX} disabled={action.pending} autoFocus required />
          </div>
          {props.children}
          {action.failure && <ContentFailureNotice failure={action.failure} />}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => close(false)} disabled={action.pending}>{props.cancelLabel}</Button>
            <Button type="submit" disabled={!name.trim() || action.pending || props.canSubmit === false}>
              {action.pending && <Loader2 className="animate-spin" aria-hidden />}
              {props.submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
