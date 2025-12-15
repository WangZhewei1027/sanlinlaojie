import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

export interface Workspace {
  id: string;
  name: string;
  description: string | null;
}

export function useWorkspace() {
  const router = useRouter();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string | null>(
    null
  );
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
        // 获取用户可访问的所有工作空间
        const response = await fetch("/api/workspaces");
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
          setError("未找到可用的工作区");
        }
      } catch (err) {
        console.error("获取工作空间失败:", err);
        setError(err instanceof Error ? err.message : "获取工作空间失败");
      } finally {
        setLoading(false);
      }
    };

    initializeUser();
  }, [router]);

  const selectedWorkspace = workspaces.find(
    (w) => w.id === selectedWorkspaceId
  );

  return {
    workspaces,
    selectedWorkspaceId,
    selectedWorkspace,
    setSelectedWorkspaceId,
    userId,
    loading,
    error,
  };
}
