"use client";

import { useEffect, useMemo, useState } from "react";
import type { ContentPerson } from "@/app/manage/content/types";

/** Row of the existing `GET /api/organizations/[id]/members` endpoint. */
interface OrganizationMemberRow {
  user_id: string;
  role: "owner" | "admin" | "member" | "viewer";
  users: { user_id: string; name: string | null; email: string | null } | null;
}

export interface OrganizationPeople {
  /** user_id → display person, for maintainer/author/updater names. */
  byId: ReadonlyMap<string, ContentPerson>;
  /** Members whose organization role can write (maintainer transfer candidates). */
  writable: ContentPerson[];
  loaded: boolean;
}

const cache = new Map<string, OrganizationMemberRow[]>();

/**
 * Names of organization members. Org viewers may not list members (403); the
 * map then stays empty and callers fall back to ids from the DTOs.
 */
export function useOrganizationPeople(organizationId: string | null): OrganizationPeople {
  const [rows, setRows] = useState<{ key: string; rows: OrganizationMemberRow[] } | null>(null);
  useEffect(() => {
    if (!organizationId) return;
    const hit = cache.get(organizationId);
    if (hit) { setRows({ key: organizationId, rows: hit }); return; }
    const abort = new AbortController();
    fetch(`/api/organizations/${encodeURIComponent(organizationId)}/members`, { signal: abort.signal })
      .then(async (response) => (response.ok ? ((await response.json()) as { data?: OrganizationMemberRow[] }).data ?? [] : []))
      .catch(() => [] as OrganizationMemberRow[])
      .then((data) => {
        if (abort.signal.aborted) return;
        cache.set(organizationId, data);
        setRows({ key: organizationId, rows: data });
      });
    return () => abort.abort();
  }, [organizationId]);

  return useMemo(() => {
    const current = rows && rows.key === organizationId ? rows.rows : [];
    const byId = new Map<string, ContentPerson>();
    const writable: ContentPerson[] = [];
    for (const row of current) {
      const person = { id: row.user_id, name: row.users?.name || row.users?.email || row.user_id.slice(0, 8) };
      byId.set(row.user_id, person);
      if (row.role !== "viewer") writable.push(person);
    }
    return { byId, writable, loaded: !!rows && rows.key === organizationId };
  }, [rows, organizationId]);
}
