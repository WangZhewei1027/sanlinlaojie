import { useState, useEffect, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabase/client";

export interface Organization {
  id: string;
  name: string;
  description: string | null;
  role?: string;
  map_center?: { lat: number; lng: number } | null;
  allowed_file_types?: string[] | null;
}

export interface Workspace {
  id: string;
  name: string;
  description: string | null;
  organization_id?: string;
}

export function useWorkspace(
  initialOrgId?: string | null,
  initialWorkspaceId?: string | null,
) {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [selectedOrganizationId, setSelectedOrganizationId] = useState<
    string | null
  >(null);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string | null>(
    null,
  );
  const [userId, setUserId] = useState<string | null>(null);
  const [currentUserRole, setCurrentUserRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Track current selections via refs so initializeUser can access them without
  // being added to useCallback deps (which would cause infinite re-runs).
  const preferredOrgIdRef = useRef<string | null>(initialOrgId ?? null);
  const preferredWorkspaceIdRef = useRef<string | null>(
    initialWorkspaceId ?? null,
  );

  // 根据 organization 获取 workspaces
  const fetchWorkspaces = useCallback(
    async (orgId: string | null, preferWorkspaceId?: string | null) => {
      try {
        const url = orgId
          ? `/api/workspaces?organization_id=${orgId}`
          : "/api/workspaces";
        const response = await fetch(url);
        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error || "获取工作空间失败");
        }

        const workspaceList = result.data || [];
        setWorkspaces(workspaceList);

        if (workspaceList.length > 0) {
          // Prefer the provided workspace ID if it still exists in the new list,
          // then fall back to the first item.
          const preferred = preferWorkspaceId
            ? workspaceList.find(
                (w: { id: string }) => w.id === preferWorkspaceId,
              )
            : null;
          const targetId = preferred ? preferred.id : workspaceList[0].id;
          setSelectedWorkspaceId(targetId);
          preferredWorkspaceIdRef.current = targetId;
        } else {
          setSelectedWorkspaceId(null);
          preferredWorkspaceIdRef.current = null;
        }
      } catch (err) {
        console.error("获取工作空间失败:", err);
        setError(err instanceof Error ? err.message : "获取工作空间失败");
      }
    },
    [],
  );

  // 切换 organization 时重新获取 workspaces
  const handleOrganizationChange = useCallback(
    async (orgId: string) => {
      setSelectedOrganizationId(orgId);
      preferredOrgIdRef.current = orgId;
      // Reset workspace preference when org changes
      preferredWorkspaceIdRef.current = null;
      await fetchWorkspaces(orgId);
    },
    [fetchWorkspaces],
  );

  const initializeUser = useCallback(async () => {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      // Clear state when no user
      setUserId(null);
      setCurrentUserRole(null);
      setOrganizations([]);
      setSelectedOrganizationId(null);
      setWorkspaces([]);
      setSelectedWorkspaceId(null);
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

        // Restore preferred workspace across token refreshes / re-inits.
        await fetchWorkspaces(targetOrgId, preferredWorkspaceIdRef.current);
      } else {
        setError("未找到可用的组织");
      }
    } catch (err) {
      console.error("初始化失败:", err);
      setError(err instanceof Error ? err.message : "初始化失败");
    } finally {
      setLoading(false);
    }
  }, [fetchWorkspaces]);

  // Initialize on mount
  useEffect(() => {
    initializeUser();
  }, [initializeUser]);

  // Re-initialize when auth state changes (login/logout)
  const initializedRef = useRef(false);
  useEffect(() => {
    const supabase = createClient();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      // Skip the initial INITIAL_SESSION event to avoid double-fetching
      if (!initializedRef.current) {
        initializedRef.current = true;
        return;
      }
      if (
        event === "SIGNED_IN" ||
        event === "SIGNED_OUT" ||
        event === "TOKEN_REFRESHED"
      ) {
        setLoading(true);
        setError(null);
        initializeUser();
      }
    });

    return () => subscription.unsubscribe();
  }, [initializeUser]);

  const selectedOrganization = organizations.find(
    (o) => o.id === selectedOrganizationId,
  );

  const selectedWorkspace = workspaces.find(
    (w) => w.id === selectedWorkspaceId,
  );

  return {
    organizations,
    selectedOrganizationId,
    selectedOrganization,
    setSelectedOrganizationId: handleOrganizationChange,
    workspaces,
    selectedWorkspaceId,
    selectedWorkspace,
    setSelectedWorkspaceId,
    // Call this when the user picks a workspace outside the hook so that the
    // preference ref stays up-to-date for future re-initialisations.
    setPreferredWorkspaceId: (id: string | null) => {
      preferredWorkspaceIdRef.current = id;
    },
    userId,
    currentUserRole,
    loading,
    error,
  };
}
