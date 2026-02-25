import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

export interface Organization {
  id: string;
  name: string;
  description: string | null;
  role?: string;
}

export interface Workspace {
  id: string;
  name: string;
  description: string | null;
  organization_id?: string;
}

export function useWorkspace() {
  const router = useRouter();
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

  // 根据 organization 获取 workspaces
  const fetchWorkspaces = useCallback(async (orgId: string | null) => {
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

      // 默认选择第一个 workspace
      if (workspaceList.length > 0) {
        setSelectedWorkspaceId(workspaceList[0].id);
      } else {
        setSelectedWorkspaceId(null);
      }
    } catch (err) {
      console.error("获取工作空间失败:", err);
      setError(err instanceof Error ? err.message : "获取工作空间失败");
    }
  }, []);

  // 切换 organization 时重新获取 workspaces
  const handleOrganizationChange = useCallback(
    async (orgId: string) => {
      setSelectedOrganizationId(orgId);
      await fetchWorkspaces(orgId);
    },
    [fetchWorkspaces],
  );

  useEffect(() => {
    const initializeUser = async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/auth/login");
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
        }

        const orgResult = await orgResponse.json();

        if (!orgResponse.ok) {
          throw new Error(orgResult.error || "获取组织失败");
        }

        const orgList = orgResult.data || [];
        setOrganizations(orgList);

        // 默认选择第一个 organization
        if (orgList.length > 0) {
          const firstOrgId = orgList[0].id;
          setSelectedOrganizationId(firstOrgId);

          // 获取该 organization 下的 workspaces
          await fetchWorkspaces(firstOrgId);
        } else {
          setError("未找到可用的组织");
        }
      } catch (err) {
        console.error("初始化失败:", err);
        setError(err instanceof Error ? err.message : "初始化失败");
      } finally {
        setLoading(false);
      }
    };

    initializeUser();
  }, [router, fetchWorkspaces]);

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
    userId,
    currentUserRole,
    loading,
    error,
  };
}
