"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { isSidebarItemVisible } from "@/lib/permissions";
import { useManageStore } from "@/app/manage/store";

// 团队设置入口：落到当前角色能看到的第一页（设置 → 成员 → 合集）。
// 合集页对 v2 团队会再跳到 /manage/collections。
export default function AdminIndex() {
  const router = useRouter();
  const globalRole = useManageStore((state) => state.currentUserRole);
  const orgRole = useManageStore((state) => state.selectedOrganization?.role ?? null);
  const loading = useManageStore((state) => state.organizationLoading);

  useEffect(() => {
    if (loading) return;
    const target = ["/admin/settings", "/admin/members", "/admin/workspaces"].find((href) => isSidebarItemVisible(href, globalRole, orgRole)) ?? "/admin/workspaces";
    router.replace(target);
  }, [loading, globalRole, orgRole, router]);

  return null;
}
