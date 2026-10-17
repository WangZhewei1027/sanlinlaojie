"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ContentNotice } from "@/app/manage/content/ContentFeedback";
import { useIntegrationText, type IntegrationTexts } from "../../lib/integration-text";

const TEXTS: IntegrationTexts = {
  "contentModel.integration.sceneConflict.title": ["场景已被他人保存，你的修改尚未保存", "Someone else saved this scene; your changes are not saved"],
  "contentModel.integration.sceneConflict.body": [
    "本地草稿仍保留在编辑器中。可以先复制草稿 JSON 备份，再载入服务器上的最新版本后重新修改。",
    "Your local draft is still in the editor. Copy the draft JSON as a backup, then load the server version and reapply your changes.",
  ],
  "contentModel.integration.sceneConflict.copy": ["复制草稿 JSON", "Copy draft JSON"],
  "contentModel.integration.sceneConflict.copied": ["已复制", "Copied"],
  "contentModel.integration.sceneConflict.download": ["下载草稿", "Download draft"],
  "contentModel.integration.sceneConflict.reload": ["载入服务器版本", "Load server version"],
  "contentModel.integration.sceneConflict.dismiss": ["继续编辑", "Keep editing"],
  "contentModel.integration.sceneConflict.reloadConfirm": ["载入服务器版本会丢弃本地未保存的修改。继续吗？", "Loading the server version discards your unsaved local changes. Continue?"],
};

/** Recovery for 409/428 on save: never overwrites the server, never drops the local draft silently. */
export function SceneConflictBanner({ draftJson, fileName, onReload, onDismiss }: { draftJson: () => string; fileName: string; onReload: () => void; onDismiss: () => void }) {
  const tx = useIntegrationText(TEXTS);
  const [copied, setCopied] = useState(false);
  const download = () => {
    const url = URL.createObjectURL(new Blob([draftJson()], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = url; link.download = fileName; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return <div className="shrink-0 border-b bg-background px-4 py-2">
    <ContentNotice
      tone="warning"
      title={tx("contentModel.integration.sceneConflict.title")}
      description={tx("contentModel.integration.sceneConflict.body")}
      action={<>
        <Button variant="outline" size="sm" onClick={() => { void navigator.clipboard?.writeText(draftJson()).then(() => setCopied(true)).catch(download); }}>{tx(copied ? "contentModel.integration.sceneConflict.copied" : "contentModel.integration.sceneConflict.copy")}</Button>
        <Button variant="ghost" size="sm" onClick={download}>{tx("contentModel.integration.sceneConflict.download")}</Button>
        <Button variant="outline" size="sm" onClick={() => { if (window.confirm(tx("contentModel.integration.sceneConflict.reloadConfirm"))) onReload(); }}>{tx("contentModel.integration.sceneConflict.reload")}</Button>
        <Button variant="ghost" size="sm" onClick={onDismiss}>{tx("contentModel.integration.sceneConflict.dismiss")}</Button>
      </>}
    />
  </div>;
}
