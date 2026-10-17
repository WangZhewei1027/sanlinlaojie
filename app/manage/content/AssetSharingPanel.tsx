"use client";

import { useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { Text } from "@/components/ui/typography";
import { cn } from "@/lib/utils";
import { AssetGrantRow } from "./AssetGrantRow";
import { AssetGrantPicker } from "./AssetGrantPicker";
import { ContentFailureNotice } from "./ContentFeedback";
import { ContentSection } from "./ContentSection";
import { useContentAction } from "./useContentAction";
import type { AssetProjectGrant, AssetVisibility, ContentAction, ContentProject } from "./types";

export interface AssetSharingPanelProps {
  visibility: AssetVisibility;
  grants: AssetProjectGrant[];
  /** Same-organization projects without a grant that the maintainer may authorize. */
  grantableProjects: ContentProject[];
  canMaintain: boolean;
  archived: boolean;
  onVisibilityChange: ContentAction<[visibility: AssetVisibility]>;
  onGrant: ContentAction<[projectId: string]>;
  /** Refused with a conflict and impact lines while drafts, revisions or placements depend on it. */
  onRevoke: ContentAction<[projectId: string]>;
}

export function AssetSharingPanel(props: AssetSharingPanelProps) {
  const { t } = useTranslation();
  const name = useId();
  const visibilityAction = useContentAction();
  const [draftVisibility, setDraftVisibility] = useState<AssetVisibility | null>(null);
  const editable = props.canMaintain && !props.archived;
  const shown = draftVisibility ?? props.visibility;

  const changeVisibility = async (next: AssetVisibility) => {
    if (next === props.visibility) return;
    setDraftVisibility(next);
    await visibilityAction.run(() => props.onVisibilityChange(next));
    setDraftVisibility(null);
  };

  return (
    <ContentSection title={t("contentModel.sharing.title")}>
      <fieldset className="space-y-2 border-b px-4 py-3" disabled={!editable || visibilityAction.pending}>
        <legend className="sr-only">{t("contentModel.sharing.visibility")}</legend>
        {(["restricted", "organization"] as const).map((value) => (
          <label
            key={value}
            className={cn(
              "flex cursor-pointer gap-3 rounded-md border px-3 py-2.5 transition-colors has-[:focus-visible]:ring-1 has-[:focus-visible]:ring-ring",
              shown === value ? "border-primary/40 bg-primary/5" : "hover:bg-muted/50",
              !editable && "cursor-default hover:bg-transparent",
            )}
          >
            <input
              type="radio"
              name={name}
              value={value}
              checked={shown === value}
              onChange={() => changeVisibility(value)}
              className="mt-1 size-4 shrink-0 accent-primary"
            />
            <span className="space-y-0.5">
              <Text as="span" variant="bodySm" fontWeight="medium" tone="default" className="block">{t(`contentModel.sharing.${value}`)}</Text>
              <Text as="span" variant="bodySm" tone="subdued" className="block">{t(`contentModel.sharing.${value}Hint`)}</Text>
            </span>
          </label>
        ))}
        {visibilityAction.failure && <ContentFailureNotice failure={visibilityAction.failure} />}
        {!props.canMaintain && <Text as="p" variant="bodySm" tone="subdued">{t("contentModel.sharing.maintainerOnly")}</Text>}
      </fieldset>

      <div className="px-4 pt-3">
        <Text as="h3" variant="bodySm" fontWeight="semibold" tone="default">{t("contentModel.sharing.projects")}</Text>
        <Text as="p" variant="bodySm" tone="subdued">{t("contentModel.sharing.projectsHint")}</Text>
      </div>
      <ul className="divide-y px-4">
        {props.grants.map((grant) => (
          <AssetGrantRow key={grant.projectId} grant={grant} canRevoke={props.canMaintain} onRevoke={props.onRevoke} />
        ))}
      </ul>
      {props.grants.length === 0 && (
        <Text as="p" variant="bodySm" tone="subdued" className="px-4 py-3">{t("contentModel.sharing.noProjects")}</Text>
      )}
      {editable && (
        props.grantableProjects.length > 0 ? (
          <AssetGrantPicker projects={props.grantableProjects} onGrant={props.onGrant} />
        ) : (
          <div className="border-t px-4 py-3">
            <Text as="p" variant="bodySm" tone="subdued">{t("contentModel.sharing.allProjectsGranted")}</Text>
          </div>
        )
      )}
      {!editable && props.archived && (
        <div className="border-t px-4 py-3">
          <Text as="p" variant="bodySm" tone="subdued">{t("contentModel.sharing.archivedHint")}</Text>
        </div>
      )}
    </ContentSection>
  );
}
