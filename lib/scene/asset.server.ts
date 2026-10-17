import "server-only";
import { db, sql } from "@/lib/db";
import { parseSceneText, SceneAssetError } from "./validate";
import type { SceneAssetManifest, SceneDefinition } from "./protocol";

/** Compare authored fields without relying on timestamp precision or a schema migration. */
export const sceneRevision = sql<string>`md5(jsonb_build_array(name, text_content, config)::text)`;

interface ModelRow {
  id: string;
  file_type: string;
  file_url: string | null;
  workspace_id: string[] | null;
}

/** Only current model rows in every target workspace may be referenced. */
export function resolveModelRows(definition: SceneDefinition, workspaceIds: string[], rows: ModelRow[]): SceneAssetManifest["resources"] {
  if (!workspaceIds.length) throw new SceneAssetError("场景没有可用工作空间");
  const byId = new Map(rows.map((row) => [row.id, row]));
  const resources: SceneAssetManifest["resources"] = {};
  for (const [alias, ref] of Object.entries(definition.content.assets)) {
    const model = byId.get(ref.assetId.toLowerCase());
    if (!model || !workspaceIds.every((id) => model.workspace_id?.includes(id.toLowerCase())))
      throw new SceneAssetError(`场景资源 ${alias} 不存在或不在场景所在工作空间`);
    if (model.file_type !== "model" || !model.file_url)
      throw new SceneAssetError(`场景资源 ${alias} 必须是有文件的模型素材`);
    resources[alias] = { assetId: model.id, url: model.file_url };
  }
  return resources;
}

export async function resolveSceneAsset(text: unknown, workspaceIds: string[]) {
  const definition = parseSceneText(text);
  const ids = [...new Set(Object.values(definition.content.assets).map((ref) => ref.assetId))];
  const models = ids.length ? await db.selectFrom("asset").select(["id", "file_type", "file_url", "workspace_id"]).where("id", "in", ids).execute() : [];
  return { ...definition, resources: resolveModelRows(definition, workspaceIds, models) };
}

/** Same public org/workspace scope as nearby assets; no arbitrary cross-workspace references. */
export async function getSceneAsset(assetId: string, workspaceId: string | null, organizationId: string | null): Promise<SceneAssetManifest> {
  if (!workspaceId && !organizationId) throw new SceneAssetError("缺少工作空间或组织");
  const asset = await db.selectFrom("asset").select(["id", "text_content", "workspace_id"]).where("id", "=", assetId).where("file_type", "=", "scene").executeTakeFirst();
  if (!asset?.workspace_id?.length) throw new SceneAssetError("场景素材不存在", 404);
  // Legacy organizations only, open scopes only (cut-over ones resolve fixed revisions).
  let query = db
    .selectFrom("workspace")
    .innerJoin("organization", "organization.id", "workspace.organization_id")
    .select("workspace.id")
    .where("workspace.id", "in", asset.workspace_id)
    .where("workspace.archived_at", "is", null)
    .where("organization.archived_at", "is", null)
    .where("organization.content_model_state", "<>", "v2");
  if (workspaceId) query = query.where("workspace.id", "=", workspaceId);
  if (organizationId) query = query.where("workspace.organization_id", "=", organizationId);
  const scope = await query.execute();
  if (!scope.length) throw new SceneAssetError("场景素材不存在", 404);
  return { assetId, ...await resolveSceneAsset(asset.text_content, scope.map((row) => row.id)) };
}
