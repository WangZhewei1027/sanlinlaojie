import { useManageStore } from "@/app/manage/store";
import { authClient } from "@/lib/auth/client";
import { useCallback, useEffect, useRef, useState } from "react";

import type { Organization } from "@/app/manage/types";

export function useTeam(
  initialOrgId?: string | null,
) {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [selectedOrganizationId, setSelectedOrganizationId] = useState<
    string | null
  >(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [currentUserRole, setCurrentUserRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Track current selections via refs so initializeUser can access them without
  // being added to useCallback deps (which would cause infinite re-runs).
  const preferredOrgIdRef = useRef<string | null>(initialOrgId ?? null);
  const handleOrganizationChange = useCallback((orgId: string) => {
    setSelectedOrganizationId(orgId);
    preferredOrgIdRef.current = orgId;
  }, []);

  const initializeUser = useCallback(async () => {
    const { data: session } = await authClient.getSession();
    const user = session?.user ?? null;

    if (!user) {
      // Clear state when no user
      setUserId(null);
      setCurrentUserRole(null);
      setOrganizations([]);
      setSelectedOrganizationId(null);
      setLoading(false);
      return;
    }

    setUserId(user.id);

    try {
      // Fetch user global role and organizations in parallel
      const [roleResponse, orgResponse] = await Promise.all([
        fetch("/api/auth/role"),
        fetch("/api/organizations"),
      ]);

      const roleResult = await roleResponse.json();
      if (roleResponse.ok && roleResult.role) {
        setCurrentUserRole(roleResult.role);
      } else {
        setCurrentUserRole(null);
      }

      const orgResult = await orgResponse.json();

      if (!orgResponse.ok) {
        throw new Error(orgResult.error || "获取组织失败");
      }

      const orgList = orgResult.data || [];
      setOrganizations(orgList);

      if (orgList.length > 0) {
        // Prefer the previously selected org (persisted via ref) if it still
        // exists in the fetched list; otherwise fall back to the first item.
        const preferred = preferredOrgIdRef.current
          ? orgList.find(
              (o: { id: string }) => o.id === preferredOrgIdRef.current,
            )
          : null;
        const targetOrgId = preferred ? preferred.id : orgList[0].id;

        setSelectedOrganizationId(targetOrgId);
        preferredOrgIdRef.current = targetOrgId;

      } else {
        setError("未找到可用的组织");
      }
    } catch (err) {
      console.error("初始化失败:", err);
      setError(err instanceof Error ? err.message : "初始化失败");
    } finally {
      setLoading(false);
    }
  }, []);

  // Initialize on mount
  useEffect(() => {
    initializeUser();
  }, [initializeUser]);

  // Re-initialize when auth state changes (login/logout). Better Auth's
  // useSession() re-renders on sign-in / sign-out; we only react when the
  // signed-in user actually changes, never on session refreshes.
  const { data: session, isPending } = authClient.useSession();
  const sessionUserId = session?.user.id ?? null;
  const initializedRef = useRef(false);
  const lastUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    // Wait for the first resolved session so the mount-time initializeUser()
    // is not duplicated.
    if (isPending) return;
    if (!initializedRef.current) {
      initializedRef.current = true;
      lastUserIdRef.current = sessionUserId;
      return;
    }
    if (sessionUserId === lastUserIdRef.current) {
      // Session refresh / same user: do nothing. Token rotation doesn't change
      // org membership; server APIs enforce permission on every request.
      // Avoid silent re-init to prevent cascading re-renders.
      return;
    }
    lastUserIdRef.current = sessionUserId;

    if (sessionUserId === null) {
      // Session ended (explicit logout OR expiry): clear the persisted
      // team selection so the next user on this machine does
      // not inherit it. Explicit logout buttons also call reset(), but
      // session expiry only surfaces here.
      useManageStore.getState().reset();
    }
    // Real auth transition: reload team data.
    setLoading(true);
    setError(null);
    initializeUser();
  }, [isPending, sessionUserId, initializeUser]);

  const selectedOrganization = organizations.find(
    (o) => o.id === selectedOrganizationId,
  );

  return {
    organizations,
    selectedOrganizationId,
    selectedOrganization,
    setSelectedOrganizationId: handleOrganizationChange,
    userId,
    currentUserRole,
    loading,
    error,
  };
}
