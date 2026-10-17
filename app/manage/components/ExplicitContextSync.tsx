"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";
import { ORGANIZATION_PARAM, WORKSPACE_PARAM } from "../lib/content-context";

interface ExplicitContextSyncProps {
  loading: boolean;
  organizations: { id: string }[];
  selectedOrganizationId: string | null;
  changeOrganization: (id: string) => Promise<void> | void;
}

/** Shared links select the team once; subsequent team changes update the URL. */
export function ExplicitContextSync({ loading, organizations, selectedOrganizationId, changeOrganization }: ExplicitContextSyncProps) {
  const params = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const explicit = params.get(ORGANIZATION_PARAM);
  const applied = useRef<string | null>(null);

  useEffect(() => {
    if (loading || !explicit) return;
    if (applied.current !== explicit) {
      if (explicit !== selectedOrganizationId && organizations.some((team) => team.id === explicit)) {
        void changeOrganization(explicit);
        return;
      }
      applied.current = explicit;
      return;
    }
    if (!selectedOrganizationId || explicit === selectedOrganizationId) return;
    const next = new URLSearchParams(params.toString());
    next.set(ORGANIZATION_PARAM, selectedOrganizationId);
    next.delete(WORKSPACE_PARAM);
    applied.current = selectedOrganizationId;
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  }, [explicit, loading, organizations, selectedOrganizationId, changeOrganization, params, pathname, router]);
  return null;
}
