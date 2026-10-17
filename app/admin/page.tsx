"use client";

import { useManageStore } from "@/app/manage/store";
import { isSidebarItemVisible } from "@/lib/permissions";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

// 团队设置入口：落到当前角色能看到的设置页。
export default function AdminIndex() {
  const router = useRouter();
  const globalRole = useManageStore((state) => state.currentUserRole);
  const orgRole = useManageStore((state) => state.selectedOrganization?.role ?? null);
  const loading = useManageStore((state) => state.organizationLoading);

  useEffect(() => {
    if (loading) return;
    const target = ["/admin/settings", "/admin/members"].find((href) => isSidebarItemVisible(href, globalRole, orgRole)) ?? "/403";
    router.replace(target);
  }, [loading, globalRole, orgRole, router]);

  return null;
}
