"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { SceneList } from "@/app/manage/content/SceneList";
import { DEFAULT_SCENE_FILTERS, type ContentProject, type SceneListFilters } from "@/app/manage/content/types";
import { Text } from "@/components/ui/typography";
import type { SceneSummaryDto } from "@/lib/content-model/contracts";
import { ContentNav } from "../../components/ContentNav";
import { ContentFeatureState } from "../../components/ContentFeatureState";
import { newIdempotencyKey, sceneApi, workspaceApi } from "../../lib/content-api";
import { contextHref, useContentContext, useContentModel, useWorkspaceInfo } from "../../lib/content-context";
import { ERROR_TEXTS, errorMessage, runContentAction } from "../../lib/content-errors";
import { toSceneListItem } from "../../lib/content-mappers";
import { useOrganizationPeople } from "../../lib/content-people";
import { useProjectCapabilities } from "../../lib/content-projects";
import { useIntegrationText, type IntegrationTexts } from "../../lib/integration-text";
import { SceneImportDialog } from "./SceneImportDialog";

const TEXTS: IntegrationTexts = {
  ...ERROR_TEXTS,
  "contentModel.integration.scenes.title": ["场景", "Scenes"],
  "contentModel.integration.scenes.subtitle": ["项目内的作品。编辑草稿不会影响已发布的内容。", "Works in this project. Editing a draft never changes what is published."],
};

export function ScenesPage() {
  const tx = useIntegrationText(TEXTS);
  const router = useRouter();
  const context = useContentContext();
  const { organizationId, workspaceId } = context;
  const model = useContentModel(organizationId);
  const info = useWorkspaceInfo(model.state === "v2" ? workspaceId : null);
  const people = useOrganizationPeople(model.state === "v2" ? organizationId : null);
  const [filters, setFilters] = useState<SceneListFilters>(DEFAULT_SCENE_FILTERS);
  const [scenes, setScenes] = useState<SceneSummaryDto[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState<string>();
  const [importOpen, setImportOpen] = useState(false);
  const [nonce, setNonce] = useState(0);
  const createKey = useRef<string | null>(null);

  const enabled = model.state === "v2" && !!workspaceId;
  useEffect(() => {
    if (!enabled || !workspaceId) return;
    const abort = new AbortController();
    setStatus("loading");
    workspaceApi.scenes(workspaceId, { state: "all" }, abort.signal)
      .then((result) => { setScenes(result.items); setStatus("ready"); })
      .catch((cause) => { if (!abort.signal.aborted) { setError(errorMessage(cause, tx)); setStatus("error"); } });
    return () => abort.abort();
  }, [enabled, workspaceId, nonce, tx]);
  const reload = useCallback(() => setNonce((value) => value + 1), []);

  const orgWorkspaceIds = useMemo(
    () => context.workspaces.filter((item) => !item.organization_id || item.organization_id === organizationId).map((item) => item.id),
    [context.workspaces, organizationId],
  );
  const projects = useProjectCapabilities(model.state === "v2" ? orgWorkspaceIds : []);
  const copyTargets: ContentProject[] = projects.writable.map((item) => ({ id: item.id, name: item.name }));

  const workspace = info.workspace;
  const project: ContentProject | null = workspaceId
    ? { id: workspaceId, name: workspace?.name ?? context.workspace?.name ?? workspaceId.slice(0, 8), archived: !!workspace?.archived_at }
    : null;
  const canEdit = model.state === "v2" && !!workspace?.capabilities.can_edit;

  const items = useMemo(() => {
    const query = filters.query.trim().toLowerCase();
    return scenes
      .map((scene) => toSceneListItem(scene, people.byId))
      .filter((scene) => (filters.status === "current" ? scene.status !== "archived" : scene.status === filters.status))
      .filter((scene) => !query || scene.name.toLowerCase().includes(query));
  }, [scenes, people.byId, filters]);

  const editorHref = (sceneId: string, targetWorkspaceId = workspaceId) => contextHref(`/manage/scenes/${sceneId}`, { organizationId, workspaceId: targetWorkspaceId });
  const lockOf = (sceneId: string) => scenes.find((scene) => scene.id === sceneId)?.lock_version ?? 0;

  const header = (
    <header className="space-y-3">
      <ContentNav organizationId={organizationId} workspaceId={context.isAll ? null : workspaceId} />
      <div className="space-y-1">
        <Text as="h1" variant="headingLg">{tx("contentModel.integration.scenes.title")}</Text>
        <Text as="p" variant="bodySm" tone="subdued">{tx("contentModel.integration.scenes.subtitle")}</Text>
      </div>
    </header>
  );

  const body = () => {
    if (!organizationId) return <ContentFeatureState state="no-organization" mapHref="/manage" />;
    if (model.status === "error") return <ContentFeatureState state="error" error={model.error} onRetry={model.refresh} mapHref="/manage" />;
    if (model.status === "loading") return null;
    if (model.state !== "v2") return <ContentFeatureState state={model.state ?? "legacy"} mapHref={contextHref("/manage", { organizationId, workspaceId })} />;
    return (
      <SceneList
        organizationName={context.organization?.name ?? ""}
        project={project}
        role={workspace?.project_role ?? null}
        canEdit={canEdit}
        filters={filters}
        onFiltersChange={setFilters}
        status={status}
        errorMessage={error}
        onRetry={reload}
        scenes={items}
        getSceneHref={(sceneId) => editorHref(sceneId)}
        onCreate={(name) => {
          if (!workspaceId) return Promise.resolve();
          createKey.current ??= newIdempotencyKey();
          return runContentAction(() => workspaceApi.createScene(workspaceId, { name, idempotencyKey: createKey.current! }), tx, (scene) => {
            createKey.current = null;
            router.push(editorHref(scene.id));
          });
        }}
        onImport={() => setImportOpen(true)}
        copyTargets={copyTargets}
        onCopy={(sceneId, input) => runContentAction(
          () => sceneApi.copy(sceneId, { targetWorkspaceId: input.projectId, name: input.name, idempotencyKey: newIdempotencyKey() }),
          tx,
          (scene) => { if (scene.workspace_id === workspaceId) reload(); else router.push(editorHref(scene.id, scene.workspace_id)); },
        )}
        onArchive={(sceneId) => runContentAction(() => sceneApi.save(sceneId, { expectedLockVersion: lockOf(sceneId), state: "archived" }), tx, reload)}
        onRestore={(sceneId) => runContentAction(() => sceneApi.save(sceneId, { expectedLockVersion: lockOf(sceneId), state: "active" }), tx, reload)}
      />
    );
  };

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-6 lg:px-8">
      {header}
      {body()}
      {workspaceId && canEdit && (
        <SceneImportDialog
          open={importOpen}
          onOpenChange={setImportOpen}
          projectName={project?.name ?? ""}
          workspaceId={workspaceId}
          onImported={(sceneId) => router.push(editorHref(sceneId))}
        />
      )}
    </div>
  );
}
