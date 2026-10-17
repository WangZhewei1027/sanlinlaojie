"use client";

import { useId, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Eye, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Text } from "@/components/ui/typography";
import { CollectionArchiveDialog } from "./CollectionArchiveDialog";
import { CollectionFormDialog } from "./CollectionFormDialog";
import { CollectionRow } from "./CollectionRow";
import { ContentEmptyState, ContentErrorState, ContentFailureNotice, ContentListSkeleton } from "./ContentFeedback";
import type { ContentActionFailure } from "./useContentAction";
import type { CollectionInput, CollectionItem, ContentAction, ContentLifecycle, ContentLoadStatus, TeamSummary } from "./types";

export interface CollectionListProps {
  team: TeamSummary;
  state: ContentLifecycle;
  onStateChange: (state: ContentLifecycle) => void;
  status: ContentLoadStatus;
  errorMessage?: string;
  onRetry?: () => void;
  collections: CollectionItem[];
  getHref: (collectionId: string) => string;
  /** Team-level write access for creating collections; per-row rights come from each item. */
  canCreate: boolean;
  readOnlyReason?: string;
  onCreate: ContentAction<[input: CollectionInput]>;
  onEdit: ContentAction<[collectionId: string, input: CollectionInput]>;
  onArchive: ContentAction<[collectionId: string]>;
  onRestore: ContentAction<[collectionId: string]>;
  notice?: ReactNode;
}

/** Map collections of the team. The first release has one collection type: maps. */
export function CollectionList(props: CollectionListProps) {
  const { t } = useTranslation();
  const headingId = useId();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<CollectionItem | null>(null);
  const [archiving, setArchiving] = useState<CollectionItem | null>(null);
  const [restoring, setRestoring] = useState<string | null>(null);
  const [failure, setFailure] = useState<ContentActionFailure | null>(null);
  const { status, collections, state } = props;

  const restore = async (collection: CollectionItem) => {
    setRestoring(collection.id);
    setFailure(null);
    try {
      const result = await props.onRestore(collection.id);
      if (result && !result.ok) setFailure(result);
    } catch (error) {
      setFailure({ ok: false, kind: "error", message: error instanceof Error ? error.message : undefined });
    } finally {
      setRestoring(null);
    }
  };
  const openForm = (collection: CollectionItem | null) => { setEditing(collection); setFormOpen(true); };

  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-5">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0 space-y-1">
          <Text as="h1" id={headingId} variant="headingLg">{t("contentModel.collections.title")}</Text>
          <Text as="p" variant="bodySm" tone="subdued" className="max-w-2xl">{t("contentModel.collections.subtitle", { team: props.team.name })}</Text>
        </div>
        {props.canCreate ? (
          <Button onClick={() => openForm(null)} className="self-start sm:self-auto"><Plus aria-hidden />{t("contentModel.collections.create")}</Button>
        ) : props.readOnlyReason ? (
          <p className="flex max-w-sm items-start gap-1.5 text-sm text-muted-foreground">
            <Eye className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span>{props.readOnlyReason}</span>
          </p>
        ) : null}
      </header>

      {props.notice}
      <div className="flex items-center justify-between gap-2">
        <Text as="p" variant="bodySm" tone="subdued" aria-live="polite">
          {status === "ready" ? t("contentModel.collections.count", { count: collections.length }) : " "}
        </Text>
        <Select value={state} onValueChange={(value) => props.onStateChange(value as ContentLifecycle)}>
          <SelectTrigger aria-label={t("contentModel.workbench.stateLabel")} className="w-auto min-w-24"><SelectValue /></SelectTrigger>
          <SelectContent>
            {(["active", "archived"] as const).map((value) => <SelectItem key={value} value={value}>{t(`contentModel.filter.states.${value}`)}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      {failure && <ContentFailureNotice failure={failure} />}

      <div className="overflow-hidden rounded-lg border bg-background">
        {status === "loading" ? (
          <ContentListSkeleton rows={4} label={t("contentModel.state.loading")} />
        ) : status === "error" ? (
          <ContentErrorState headingAs="h2" message={props.errorMessage} onRetry={props.onRetry} />
        ) : collections.length === 0 ? (
          state === "archived" ? (
            <ContentEmptyState headingAs="h2" title={t("contentModel.collections.empty.archivedTitle")} description={t("contentModel.collections.empty.archivedBody")} />
          ) : (
            <ContentEmptyState
              headingAs="h2"
              title={t("contentModel.collections.empty.title")}
              description={t(props.canCreate ? "contentModel.collections.empty.body" : "contentModel.collections.empty.viewerBody")}
              actions={props.canCreate && <Button size="sm" onClick={() => openForm(null)}><Plus aria-hidden />{t("contentModel.collections.create")}</Button>}
            />
          )
        ) : (
          <ul className="divide-y" aria-label={t("contentModel.collections.title")}>
            {collections.map((collection) => (
              <CollectionRow
                key={collection.id}
                collection={collection}
                href={props.getHref(collection.id)}
                onEdit={collection.canEdit && !collection.archived ? openForm : undefined}
                onArchive={collection.canArchive && !collection.archived ? setArchiving : undefined}
                onRestore={collection.canArchive && collection.archived ? restore : undefined}
                busy={restoring === collection.id}
              />
            ))}
          </ul>
        )}
      </div>

      <CollectionFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        collection={editing}
        onSubmit={(input) => (editing ? props.onEdit(editing.id, input) : props.onCreate(input))}
      />
      <CollectionArchiveDialog collection={archiving} onOpenChange={(open) => { if (!open) setArchiving(null); }} onArchive={props.onArchive} />
    </section>
  );
}
