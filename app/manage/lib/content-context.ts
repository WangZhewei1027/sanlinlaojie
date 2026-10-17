"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { ContentModelState, OrganizationContentModelDto, WorkspaceDto } from "@/lib/content-model/contracts";
import { hasOrgPermission, isSuperAdmin } from "@/lib/permissions";
import { useManageStore } from "../store";
import { ALL_WORKSPACES_ID, isSpecificWorkspaceId } from "../constants";
import { collectionApi, isContentApiError, isEndpointMissing, organizationApi, workspaceApi } from "./content-api";

/**
 * Query parameters that pin the team (organization) and, on legacy links, a
 * workspace. Same names as the WeChat QR deep links; `workspaceId` is only a
 * compatibility input that the v2 routes turn into a collection detail URL.
 */
export const ORGANIZATION_PARAM = "organizationId";
export const WORKSPACE_PARAM = "workspaceId";

export interface ExplicitContext {
  organizationId: string | null;
  workspaceId: string | null;
}

export function readExplicitContext(params: URLSearchParams | null | undefined): ExplicitContext {
  return {
    organizationId: params?.get(ORGANIZATION_PARAM) || null,
    workspaceId: params?.get(WORKSPACE_PARAM) || null,
  };
}

/** Build a link that carries the project context explicitly (shareable, survives other tabs). */
export function contextHref(path: string, context: { organizationId?: string | null; workspaceId?: string | null }, extra?: Record<string, string>) {
  const params = new URLSearchParams(extra);
  if (context.organizationId) params.set(ORGANIZATION_PARAM, context.organizationId);
  if (context.workspaceId) params.set(WORKSPACE_PARAM, context.workspaceId);
  const query = params.toString();
  return query ? `${path}?${query}` : path;
}

/** Team-scoped link: the organization only, never a hidden workspace. */
export function teamHref(path: string, organizationId: string | null | undefined, extra?: Record<string, string>) {
  return contextHref(path, { organizationId }, extra);
}

/** Map collection detail; `placementId` focuses one placement after load. */
export function collectionHref(collectionId: string, organizationId: string | null | undefined, extra?: Record<string, string>) {
  return teamHref(`/manage/collections/${encodeURIComponent(collectionId)}`, organizationId, extra);
}

/**
 * Team context for the workbench, collections, asset detail and editor: the
 * explicit `?organizationId=` wins over the persisted team selector. It never
 * exposes the persisted workspace selection, so no v2 command can be routed
 * through a hidden default collection. Must render under Suspense.
 */
export function useTeamContext() {
  const explicit = readExplicitContext(useSearchParams());
  const storeOrganizationId = useManageStore((state) => state.selectedOrganizationId);
  const organizations = useManageStore((state) => state.organizations);
  const loading = useManageStore((state) => state.organizationLoading);
  const currentUserRole = useManageStore((state) => state.currentUserRole);
  const organizationId = explicit.organizationId ?? storeOrganizationId;
  const organization = organizations.find((item) => item.id === organizationId) ?? null;
  const synced = !explicit.organizationId || explicit.organizationId === storeOrganizationId;
  return { organizationId, organization, organizations, loading, synced, explicit, currentUserRole };
}

export type TeamContext = ReturnType<typeof useTeamContext>;

/**
 * Keeps the header team in step with a resource page (collection, asset,
 * scene) whose owning team is only known after it loads.
 *
 * - Initial resolution: when the URL names no team or another team, the URL
 *   is rewritten to the owner (`?organizationId=` only); ExplicitContextSync
 *   then moves the header selector. Nothing actionable renders until the URL
 *   and the header agree (`settled`), so a page never shows team B's resource
 *   under team A's header. A super_admin outside the team settles once the
 *   team list is loaded, since the header cannot show that team.
 * - After that, a header change away from the owner is an intentional team
 *   switch: the page leaves for `leavePath` of the new team.
 */
export function useResourceTeam(resourceOrganizationId: string | null | undefined, leavePath: string) {
  const params = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const storeOrganizationId = useManageStore((state) => state.selectedOrganizationId);
  const organizations = useManageStore((state) => state.organizations);
  const loading = useManageStore((state) => state.organizationLoading);
  const urlOrganizationId = params.get(ORGANIZATION_PARAM);
  // Header team at the moment the page settled; a later different value is a user switch.
  const settledRef = useRef<{ store: string | null } | null>(null);
  const owner = resourceOrganizationId || null;
  const member = !!owner && organizations.some((item) => item.id === owner);
  const aligned = !!owner && urlOrganizationId === owner && (storeOrganizationId === owner || (!loading && !member));
  if (aligned && !settledRef.current) settledRef.current = { store: storeOrganizationId };

  useEffect(() => {
    if (!owner || loading) return;
    const settled = settledRef.current;
    if (settled) {
      if (storeOrganizationId && storeOrganizationId !== owner && storeOrganizationId !== settled.store) {
        router.replace(teamHref(leavePath, storeOrganizationId));
      }
      return;
    }
    if (urlOrganizationId !== owner) {
      const next = new URLSearchParams(params.toString());
      next.set(ORGANIZATION_PARAM, owner);
      next.delete(WORKSPACE_PARAM);
      router.replace(`${pathname}?${next.toString()}`, { scroll: false });
    }
  }, [owner, loading, storeOrganizationId, urlOrganizationId, params, pathname, router, leavePath]);

  return { settled: !!settledRef.current };
}

/**
 * Whether the signed-in user may create and edit team content. The server
 * re-checks every command; this only gates controls. A team capability from
 * the content-model endpoint wins when the backend declares one; otherwise
 * the current team role (never a project assignment) decides, and viewers
 * stay read-only. Readonly/legacy organizations never write v2 content.
 */
export function teamCanWrite(input: { state: ContentModelState | null; dto: OrganizationContentModelDto | null; orgRole: string | null | undefined; globalRole: string | null | undefined }) {
  if (input.state !== "v2") return false;
  // An archived team is read-only for everyone, super_admin included (server rule).
  if (input.dto?.archived_at) return false;
  const declared = (input.dto?.capabilities as { can_edit?: boolean } | undefined)?.can_edit;
  if (typeof declared === "boolean") return declared;
  return isSuperAdmin(input.globalRole) || hasOrgPermission(input.orgRole, "org.assets.write");
}

/**
 * Legacy map context: organization plus the persisted workspace selection.
 * Only the pre-v2 surfaces (legacy asset map, legacy scene editor, legacy
 * onsite upload) may read the workspace from here.
 * Must render under a Suspense boundary (useSearchParams).
 */
export function useContentContext() {
  const explicit = readExplicitContext(useSearchParams());
  const storeOrganizationId = useManageStore((state) => state.selectedOrganizationId);
  const storeWorkspaceId = useManageStore((state) => state.selectedWorkspaceId);
  const organizations = useManageStore((state) => state.organizations);
  const workspaces = useManageStore((state) => state.workspaces);
  const loading = useManageStore((state) => state.organizationLoading || state.workspaceLoading);
  const currentUserRole = useManageStore((state) => state.currentUserRole);

  const organizationId = explicit.organizationId ?? storeOrganizationId;
  const rawWorkspaceId = explicit.workspaceId ?? (explicit.organizationId && explicit.organizationId !== storeOrganizationId ? null : storeWorkspaceId);
  const isAll = rawWorkspaceId === ALL_WORKSPACES_ID;
  const workspaceId = isSpecificWorkspaceId(rawWorkspaceId) ? rawWorkspaceId : null;
  const organization = organizations.find((item) => item.id === organizationId) ?? null;
  const workspace = workspaces.find((item) => item.id === workspaceId) ?? null;
  // Until the selector store reflects the URL, names may be unknown; ids are already final.
  const synced = (!explicit.organizationId || explicit.organizationId === storeOrganizationId)
    && (!explicit.workspaceId || explicit.workspaceId === storeWorkspaceId);
  return { organizationId, workspaceId, isAll, organization, workspace, workspaces, organizations, loading, synced, explicit, currentUserRole };
}

export type ContentContext = ReturnType<typeof useContentContext>;

// ───────────────────────── organization feature state ─────────────────────────

export interface ContentModelInfo {
  status: "loading" | "ready" | "error";
  /** Null while loading or when the state endpoint is not deployed. */
  state: ContentModelState | null;
  dto: OrganizationContentModelDto | null;
  /** True when the endpoint is missing: treat the organization as legacy. */
  unavailable: boolean;
  error: string | null;
  refresh: () => void;
}

const stateCache = new Map<string, { at: number; dto: OrganizationContentModelDto | null; unavailable: boolean }>();
const STATE_TTL_MS = 30_000;

/** Server-declared cutover state of an organization (legacy | preparing | readonly | v2). */
export function useContentModel(organizationId: string | null): ContentModelInfo {
  const cached = organizationId ? stateCache.get(organizationId) : undefined;
  const fresh = cached && Date.now() - cached.at < STATE_TTL_MS ? cached : undefined;
  const [result, setResult] = useState<{ key: string | null; dto: OrganizationContentModelDto | null; unavailable: boolean; error: string | null } | null>(
    fresh ? { key: organizationId, dto: fresh.dto, unavailable: fresh.unavailable, error: null } : null,
  );
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    if (!organizationId) return;
    const hit = stateCache.get(organizationId);
    if (hit && Date.now() - hit.at < STATE_TTL_MS && nonce === 0) {
      setResult({ key: organizationId, dto: hit.dto, unavailable: hit.unavailable, error: null });
      return;
    }
    const abort = new AbortController();
    organizationApi.contentModel(organizationId, abort.signal)
      .then((dto) => {
        stateCache.set(organizationId, { at: Date.now(), dto, unavailable: false });
        setResult({ key: organizationId, dto, unavailable: false, error: null });
      })
      .catch((error) => {
        if (abort.signal.aborted) return;
        if (isEndpointMissing(error)) {
          stateCache.set(organizationId, { at: Date.now(), dto: null, unavailable: true });
          setResult({ key: organizationId, dto: null, unavailable: true, error: null });
        } else {
          setResult({ key: organizationId, dto: null, unavailable: false, error: isContentApiError(error) || error instanceof Error ? error.message : String(error) });
        }
      });
    return () => abort.abort();
  }, [organizationId, nonce]);

  const refresh = useCallback(() => {
    if (organizationId) stateCache.delete(organizationId);
    setNonce((value) => value + 1);
  }, [organizationId]);

  const current = result && result.key === organizationId ? result : null;
  if (!organizationId || !current) return { status: "loading", state: null, dto: null, unavailable: false, error: null, refresh };
  if (current.error) return { status: "error", state: null, dto: null, unavailable: false, error: current.error, refresh };
  return {
    status: "ready",
    state: current.unavailable ? "legacy" : current.dto?.content_model_state ?? "legacy",
    dto: current.dto,
    unavailable: current.unavailable,
    error: null,
    refresh,
  };
}

// ───────────────────────── collection capabilities ─────────────────────────

export interface CollectionInfo {
  status: "idle" | "loading" | "ready" | "error";
  collection: WorkspaceDto | null;
  error: unknown;
  refresh: () => void;
}

/** Collection facts; falls back to the workspace route while `/api/collections` is not deployed. */
async function loadCollection(collectionId: string, signal: AbortSignal) {
  try {
    return await collectionApi.get(collectionId, signal);
  } catch (error) {
    if (!isEndpointMissing(error)) throw error;
    return workspaceApi.info(collectionId, signal);
  }
}

/**
 * One map collection and its server capabilities. Missing capabilities are
 * treated as "no write rights"; nothing is derived from assignment roles.
 */
export function useCollectionInfo(collectionId: string | null): CollectionInfo {
  const [result, setResult] = useState<{ key: string; collection: WorkspaceDto | null; error: unknown } | null>(null);
  const [nonce, setNonce] = useState(0);
  useEffect(() => {
    if (!collectionId) return;
    const abort = new AbortController();
    loadCollection(collectionId, abort.signal)
      .then((collection) => setResult({ key: collectionId, collection: collection && "capabilities" in collection ? collection : null, error: null }))
      .catch((error) => {
        if (abort.signal.aborted) return;
        setResult({ key: collectionId, collection: null, error });
      });
    return () => abort.abort();
  }, [collectionId, nonce]);
  const refresh = useCallback(() => setNonce((value) => value + 1), []);
  if (!collectionId) return { status: "idle", collection: null, error: null, refresh };
  if (!result || result.key !== collectionId) return { status: "loading", collection: null, error: null, refresh };
  return { status: result.error ? "error" : "ready", collection: result.collection, error: result.error, refresh };
}
