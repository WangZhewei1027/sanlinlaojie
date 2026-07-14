import { redirect } from "next/navigation";

// 旧"概览"页只是三张与侧边栏重复的快捷卡片，已移除；
// 所有组织角色（含 viewer）都有 org.workspaces.view，直接落到工作空间。
export default function AdminIndex() {
  redirect("/admin/workspaces");
}
