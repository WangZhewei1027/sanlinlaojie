import { useState, useEffect } from "react";
import type { Workspace } from "../types";

export function useWorkspaces() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchWorkspaces() {
      try {
        const response = await fetch("/api/workspaces");
        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error || "获取工作空间失败");
        }

        setWorkspaces(result.data || []);

        // 默认选择第一个 workspace
        if (result.data && result.data.length > 0) {
          setSelectedWorkspaceId(result.data[0].id);
        }
      } catch (err) {
        console.error("获取 workspace 失败:", err);
        setError(err instanceof Error ? err.message : "获取工作空间失败");
      } finally {
        setLoading(false);
      }
    }

    fetchWorkspaces();
  }, []);

  const selectedWorkspace = workspaces.find(
    (w) => w.id === selectedWorkspaceId
  );

  return {
    workspaces,
    selectedWorkspaceId,
    selectedWorkspace,
    setSelectedWorkspaceId,
    loading,
    error,
  };
}
