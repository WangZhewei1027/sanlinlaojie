"use client";
import { ContentNotice } from "@/app/manage/content/ContentFeedback";
import { Button } from "@/components/ui/button";
import { useIntegrationText } from "../lib/integration-text";

export function ContentFeatureState({ state, error, onRetry }: { state: "no-organization" | "error"; error?: string | null; onRetry?: () => void }) {
  const tx = useIntegrationText({
    "team.choose": ["请选择团队", "Select a team"],
    "team.chooseHint": ["在顶部选择团队后再继续。", "Choose a team at the top to continue."],
    "team.failed": ["无法加载团队内容", "Could not load team content"],
    "team.retry": ["重试", "Retry"],
  });
  return state === "no-organization"
    ? <ContentNotice title={tx("team.choose")} description={tx("team.chooseHint")} />
    : <ContentNotice tone="critical" title={tx("team.failed")} description={error ?? undefined} action={onRetry && <Button variant="outline" size="sm" onClick={onRetry}>{tx("team.retry")}</Button>} />;
}
