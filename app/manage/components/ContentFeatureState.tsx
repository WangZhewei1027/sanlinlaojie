"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ContentNotice } from "@/app/manage/content/ContentFeedback";
import type { ContentModelState } from "@/lib/content-model/contracts";
import { useIntegrationText, type IntegrationTexts } from "../lib/integration-text";

const TEXTS: IntegrationTexts = {
  "contentModel.integration.feature.legacyTitle": ["这个团队仍在使用旧版素材管理", "This team still uses legacy asset management"],
  "contentModel.integration.feature.legacyBody": [
    "工作台、地图合集和独立场景会在团队完成迁移后启用。当前请继续在旧版素材地图中管理内容。",
    "The workbench, map collections and standalone scenes turn on after the team migrates. Keep managing content on the legacy asset map for now.",
  ],
  "contentModel.integration.feature.preparingTitle": ["团队正在准备迁移", "The team is preparing to migrate"],
  "contentModel.integration.feature.readonlyTitle": ["团队迁移中，内容暂时只读", "Migration in progress — content is read-only"],
  "contentModel.integration.feature.readonlyBody": ["切换窗口结束后即可继续编辑。", "Editing resumes when the cutover window ends."],
  "contentModel.integration.feature.openMap": ["打开素材地图", "Open asset map"],
  "contentModel.integration.feature.noOrgTitle": ["请选择团队", "Select a team"],
  "contentModel.integration.feature.noOrgBody": ["在顶部选择团队后再继续。", "Choose a team at the top to continue."],
  "contentModel.integration.feature.stateFailed": ["无法读取团队的内容模型状态", "Could not read the team's content model state"],
  "contentModel.action.retry": ["重试", "Retry"],
};

/**
 * Explains why a v2-only surface is unavailable (organization not cut over,
 * preparing, or frozen). Writes are never attempted from these states.
 */
export function ContentFeatureState({ state, mapHref, error, onRetry }: { state: ContentModelState | "no-organization" | "error"; mapHref: string; error?: string | null; onRetry?: () => void }) {
  const tx = useIntegrationText(TEXTS);
  if (state === "no-organization") {
    return <ContentNotice title={tx("contentModel.integration.feature.noOrgTitle")} description={tx("contentModel.integration.feature.noOrgBody")} />;
  }
  if (state === "error") {
    return <ContentNotice tone="critical" title={tx("contentModel.integration.feature.stateFailed")} description={error ?? undefined} action={onRetry && <Button variant="outline" size="sm" onClick={onRetry}>{tx("contentModel.action.retry")}</Button>} />;
  }
  if (state === "readonly") {
    return <ContentNotice tone="warning" title={tx("contentModel.integration.feature.readonlyTitle")} description={tx("contentModel.integration.feature.readonlyBody")} />;
  }
  return (
    <ContentNotice
      title={tx(state === "preparing" ? "contentModel.integration.feature.preparingTitle" : "contentModel.integration.feature.legacyTitle")}
      description={tx("contentModel.integration.feature.legacyBody")}
      action={<Button variant="outline" size="sm" asChild><Link href={mapHref}>{tx("contentModel.integration.feature.openMap")}</Link></Button>}
    />
  );
}
