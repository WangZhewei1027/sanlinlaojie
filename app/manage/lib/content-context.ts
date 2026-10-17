"use client";

import type { CollectionDto } from "@/lib/content-model/contracts";
import { hasOrgPermission, isSuperAdmin } from "@/lib/permissions";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { useManageStore } from "../store";
import { collectionApi } from "./content-api";

/** Explicit team and collection context in shared links and onsite QR codes. */
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
 * exposes the persisted workspace selection, so no command can be routed
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

/** UI controls mirror the team role; every command is authorized by the server. */
export function teamCanWrite(input: { archivedAt?: string | null; orgRole: string | null | undefined; globalRole: string | null | undefined }) {
  if (input.archivedAt) return false;
  return isSuperAdmin(input.globalRole) || hasOrgPermission(input.orgRole, "org.assets.write");
}

// ───────────────────────── collection capabilities ─────────────────────────

export interface CollectionInfo {
  status: "idle" | "loading" | "ready" | "error";
  collection: CollectionDto | null;
  error: unknown;
  refresh: () => void;
}

/**
 * One map collection and its server capabilities. Missing capabilities are
 * treated as "no write rights"; nothing is derived from assignment roles.
 */
export function useCollectionInfo(collectionId: string | null): CollectionInfo {
  const [result, setResult] = useState<{ key: string; collection: CollectionDto | null; error: unknown } | null>(null);
  const [nonce, setNonce] = useState(0);
  useEffect(() => {
    if (!collectionId) return;
    const abort = new AbortController();
    collectionApi.get(collectionId, abort.signal)
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
