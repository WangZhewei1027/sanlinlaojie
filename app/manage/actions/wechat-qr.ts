"use server";
import { getSessionUser } from "@/lib/auth/server";
import { db } from "@/lib/db";
import { loadActor, requireOrgRead, requireWorkspaceRead } from "@/lib/content-model/access.server";
import { getScene } from "@/lib/scene/service.server";
import { requireUuid } from "@/lib/content-model/input";
import { buildQrObjectKey, buildSceneQrObjectKey, buildWorkspaceMiniProgramPath, buildSceneMiniProgramPath } from "@/lib/wechat-qr";
import { getOrCreateQr } from "@/lib/wechat-qr.server";

async function actor() {
  const user = await getSessionUser();
  if (!user) throw new Error("未授权");
  return loadActor(db, user.id);
}

export async function getOrCreateWorkspaceQRCode(input: { organizationId: string; workspaceId?: string | null }): Promise<{ url?: string; error?: string }> {
  try {
    const current = await actor();
    const organizationId = requireUuid(input.organizationId, "organizationId");
    const workspaceId = input.workspaceId ? requireUuid(input.workspaceId, "workspaceId") : null;
    const access = await requireOrgRead(db, current, organizationId);
    if (access.org.archived_at) throw new Error("团队已归档");
    if (workspaceId) {
      const collection = await requireWorkspaceRead(db, current, workspaceId);
      if (collection.workspace.organization_id !== organizationId || collection.workspace.archived_at) throw new Error("地图合集不存在或已归档");
    }
    return { url: await getOrCreateQr(buildQrObjectKey(organizationId, workspaceId), buildWorkspaceMiniProgramPath(organizationId, workspaceId)) };
  } catch (error) { return { error: error instanceof Error ? error.message : "二维码生成失败" }; }
}

export async function getOrCreateSceneQRCode(sceneId: string): Promise<{ url?: string; error?: string }> {
  try {
    const current = await actor();
    const scene = await getScene(current, requireUuid(sceneId, "sceneId"));
    const access = await requireOrgRead(db, current, scene.organization_id);
    if (scene.state !== "active" || access.org.archived_at) throw new Error("场景或团队已归档");
    return { url: await getOrCreateQr(buildSceneQrObjectKey(scene.organization_id, scene.id), buildSceneMiniProgramPath(scene.organization_id, scene.id)) };
  } catch (error) { return { error: error instanceof Error ? error.message : "二维码生成失败" }; }
}
