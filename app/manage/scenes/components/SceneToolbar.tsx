"use client";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { ArrowLeft, Box, Save, Eye, Undo2, Redo2, SlidersHorizontal, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Text } from "@/components/ui/typography";

export interface SceneToolbarProps {
  title: string; dirty: boolean; saving: boolean; preview: boolean; canUndo: boolean; canRedo: boolean;
  onTitle: (value: string) => void; onPreview: () => void; onSave: () => void; onUndo: () => void; onRedo: () => void;
}
export function SceneToolbar(props: SceneToolbarProps) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState(props.title);
  useEffect(() => setDraft(props.title), [props.title]);
  const saveStatus = <><span className={`size-1.5 shrink-0 rounded-full ${props.dirty ? "bg-warning" : "bg-success"}`} /><Text as="span" variant="bodyXs" tone="subdued">{t(props.saving ? "sceneEditor.saving" : props.dirty ? "sceneEditor.unsaved" : "sceneEditor.saved")}</Text></>;
  return <header className="scene-toolbar" aria-label={t("sceneEditor.controls")}>
    <Button variant="ghost" size="icon" asChild title={t("sceneEditor.back")}><a href="/manage" aria-label={t("sceneEditor.back")}><ArrowLeft /></a></Button>
    <Box className="size-5 shrink-0 text-muted-foreground max-sm:hidden" />
    <div className="min-w-0 flex-1"><Input aria-label={t("sceneEditor.title")} value={draft} onChange={(event) => { setDraft(event.target.value); props.onTitle(event.target.value); }} onBlur={() => props.onTitle(draft)} onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); }} className="h-7 max-w-80 border-transparent bg-transparent px-2 font-medium shadow-none hover:border-input focus-visible:border-input sm:h-8" /><div role="status" className="flex items-center gap-1.5 whitespace-nowrap px-2 sm:hidden">{saveStatus}</div></div>
    <div role="status" className="hidden items-center gap-2 sm:flex">{saveStatus}</div>
    <div className="mx-2 hidden h-5 border-l sm:block" />
    <Button variant="ghost" size="icon" disabled={!props.canUndo} aria-label={t("sceneEditor.undo")} title={`${t("sceneEditor.undo")} (Ctrl/⌘ Z)`} onClick={props.onUndo}><Undo2 /></Button>
    <Button variant="ghost" size="icon" disabled={!props.canRedo} aria-label={t("sceneEditor.redo")} title={`${t("sceneEditor.redo")} (Ctrl/⌘ Shift Z)`} onClick={props.onRedo}><Redo2 /></Button>
    <Button variant={props.preview ? "secondary" : "ghost"} size="sm" aria-pressed={props.preview} onClick={props.onPreview}>{props.preview ? <SlidersHorizontal /> : <Eye />}<span className="hidden sm:inline">{t(props.preview ? "sceneEditor.arrange" : "sceneEditor.preview")}</span><span className="sr-only sm:hidden">{t(props.preview ? "sceneEditor.arrange" : "sceneEditor.preview")}</span></Button>
    <Button size="sm" disabled={props.saving || !draft.trim()} onClick={() => { props.onTitle(draft); props.onSave(); }} title="Ctrl/⌘ S">{props.saving ? <LoaderCircle className="animate-spin" /> : <Save />}{t(props.saving ? "sceneEditor.saving" : "common.save")}</Button>
  </header>;
}
