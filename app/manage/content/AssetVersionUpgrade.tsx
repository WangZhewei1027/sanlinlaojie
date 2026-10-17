"use client";

import { useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { Eye, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/typography";
import { ContentFailureNotice } from "./ContentFeedback";
import { ContentStatusBadge } from "./ContentStatusBadge";
import { useContentAction } from "./useContentAction";
import type { ContentAction, ContentLifecycle } from "./types";

export type UpgradeScope = "instance" | "alias";

export interface AssetVersionUpgradeProps {
  assetName: string;
  /** Identity of the selected instance; choices reset when it changes. */
  referenceId: string;
  pinnedVersionNo: number;
  latestVersionNo: number;
  assetState: ContentLifecycle;
  /** Instances in this scene sharing the same resource alias, the selected one included. */
  aliasInstanceCount: number;
  /** Set when the selected instance's animation clip is missing in the latest version. */
  missingClipName?: string | null;
  previewing?: boolean;
  onPreview?: () => void;
  /** "instance" creates a new alias for the selected object; "alias" updates every object sharing it. */
  onUpgrade: ContentAction<[scope: UpgradeScope]>;
}

/** Explicit, user-initiated upgrade of a pinned asset reference inside one scene draft. */
export function AssetVersionUpgrade(props: AssetVersionUpgradeProps) {
  const { t } = useTranslation();
  const name = useId();
  const defaultScope: UpgradeScope = props.aliasInstanceCount > 1 ? "instance" : "alias";
  const [scope, setScope] = useState<UpgradeScope>(defaultScope);
  const action = useContentAction();
  const resetKey = `${props.referenceId}:${props.aliasInstanceCount}:${props.latestVersionNo}`;
  const [shownFor, setShownFor] = useState(resetKey);
  if (shownFor !== resetKey) {
    setShownFor(resetKey);
    setScope(defaultScope);
    action.reset();
  }
  const upToDate = props.pinnedVersionNo >= props.latestVersionNo;
  const archived = props.assetState === "archived";
  const blocked = archived || !!props.missingClipName;

  if (upToDate) {
    return <Text as="p" variant="bodyXs" tone="subdued">{t("contentModel.upgrade.upToDate", { number: props.pinnedVersionNo })}</Text>;
  }

  return (
    <div className="space-y-2.5 rounded-md border px-3 py-2.5" role="group" aria-label={t("contentModel.upgrade.title", { name: props.assetName })}>
      <div className="flex flex-wrap items-center gap-2">
        <Text as="span" variant="bodySm" fontWeight="medium" className="tabular-nums">
          {t("contentModel.upgrade.pinned", { number: props.pinnedVersionNo })}
        </Text>
        <ContentStatusBadge kind="outdated" number={props.latestVersionNo} />
      </div>
      <Text as="p" variant="bodySm" tone="subdued">{t("contentModel.upgrade.hint")}</Text>

      {props.aliasInstanceCount > 1 && (
        <fieldset className="space-y-1" disabled={action.pending || blocked}>
          <legend className="mb-1 text-xs font-medium">{t("contentModel.upgrade.scope")}</legend>
          {(["instance", "alias"] as const).map((value) => (
            <label key={value} className="flex cursor-pointer items-start gap-2 text-sm">
              <input type="radio" name={name} value={value} checked={scope === value} onChange={() => setScope(value)} className="mt-0.5 size-4 shrink-0 accent-primary" />
              <span>{t(`contentModel.upgrade.scopes.${value}`, { count: props.aliasInstanceCount })}</span>
            </label>
          ))}
        </fieldset>
      )}

      {archived && <Text as="p" variant="bodySm" tone="warning">{t("contentModel.upgrade.archived")}</Text>}
      {props.missingClipName && (
        <Text as="p" variant="bodySm" tone="critical" role="alert">{t("contentModel.upgrade.missingClip", { clip: props.missingClipName, number: props.latestVersionNo })}</Text>
      )}
      {action.failure && <ContentFailureNotice failure={action.failure} />}

      <div className="flex flex-wrap gap-2">
        {props.onPreview && (
          <Button variant="outline" size="sm" onClick={props.onPreview} aria-pressed={props.previewing} disabled={archived}>
            <Eye aria-hidden />
            {t("contentModel.upgrade.preview", { number: props.latestVersionNo })}
          </Button>
        )}
        <Button size="sm" onClick={() => action.run(() => props.onUpgrade(scope))} disabled={blocked || action.pending}>
          {action.pending && <Loader2 className="animate-spin" aria-hidden />}
          {t("contentModel.upgrade.action", { number: props.latestVersionNo })}
        </Button>
      </div>
    </div>
  );
}
