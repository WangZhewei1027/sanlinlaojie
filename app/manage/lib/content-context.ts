"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { ContentModelState, OrganizationContentModelDto, WorkspaceDto } from "@/lib/content-model/contracts";
import { useManageStore } from "../store";
import { ALL_WORKSPACES_ID, isSpecificWorkspaceId } from "../constants";
import { isContentApiError, isEndpointMissing, organizationApi, workspaceApi } from "./content-api";

/** Query parameters that pin the organization/project (same names as the WeChat QR deep links). */
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

/**
 * Effective organization/project for a content page: an explicit URL value
 * wins over the persisted selector; `__all__` means aggregate browsing only.
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

// ───────────────────────── project capabilities ─────────────────────────

export interface WorkspaceInfo {
  status: "idle" | "loading" | "ready" | "error";
  workspace: WorkspaceDto | null;
  error: string | null;
  refresh: () => void;
}

/**
 * Project role and capabilities from the server. Missing or legacy-shaped
 * responses yield `workspace: null`, which callers treat as "no write rights".
 */
export function useWorkspaceInfo(workspaceId: string | null): WorkspaceInfo {
  const [result, setResult] = useState<{ key: string; workspace: WorkspaceDto | null; error: string | null } | null>(null);
  const [nonce, setNonce] = useState(0);
  useEffect(() => {
    if (!workspaceId) return;
    const abort = new AbortController();
    workspaceApi.info(workspaceId, abort.signal)
      .then((workspace) => setResult({ key: workspaceId, workspace: workspace && "capabilities" in workspace ? workspace : null, error: null }))
      .catch((error) => {
        if (abort.signal.aborted) return;
        setResult({ key: workspaceId, workspace: null, error: error instanceof Error ? error.message : String(error) });
      });
    return () => abort.abort();
  }, [workspaceId, nonce]);
  const refresh = useCallback(() => setNonce((value) => value + 1), []);
  if (!workspaceId) return { status: "idle", workspace: null, error: null, refresh };
  if (!result || result.key !== workspaceId) return { status: "loading", workspace: null, error: null, refresh };
  return { status: result.error ? "error" : "ready", workspace: result.workspace, error: result.error, refresh };
}
