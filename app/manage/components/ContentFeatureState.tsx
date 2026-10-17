"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ContentNotice } from "@/app/manage/content/ContentFeedback";
import type { ContentModelState } from "@/lib/content-model/contracts";
import { useIntegrationText, type IntegrationTexts } from "../lib/integration-text";

const TEXTS: IntegrationTexts = {
  "contentModel.integration.feature.legacyTitle": ["该组织仍在使用旧版素材管理", "This organization still uses legacy asset management"],
  "contentModel.integration.feature.legacyBody": [
    "素材库、版本与独立场景会在组织完成迁移后启用。当前请继续在投放地图中管理内容。",
    "The asset library, versions and standalone scenes turn on after the organization migrates. Keep managing content on the placement map for now.",
  ],
  "contentModel.integration.feature.preparingTitle": ["组织正在准备迁移", "The organization is preparing to migrate"],
  "contentModel.integration.feature.readonlyTitle": ["组织迁移中，内容暂时只读", "Migration in progress — content is read-only"],
  "contentModel.integration.feature.readonlyBody": ["切换窗口结束后即可继续编辑。", "Editing resumes when the cutover window ends."],
  "contentModel.integration.feature.openMap": ["打开投放地图", "Open placement map"],
  "contentModel.integration.feature.noOrgTitle": ["请选择组织", "Select an organization"],
  "contentModel.integration.feature.noOrgBody": ["在顶部选择组织和项目后再继续。", "Choose an organization and project at the top to continue."],
  "contentModel.integration.feature.stateFailed": ["无法读取组织的内容模型状态", "Could not read the organization's content model state"],
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
