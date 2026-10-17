import { getSceneAsset } from "@/lib/scene/asset.server";
import { SceneAssetError } from "@/lib/scene/validate";
import { errorResponse, json, optionalUuid, readJson, requireUuid } from "@/lib/miniapp/request";
import { RuntimeNotFound, sceneManifest, scopeState } from "@/lib/placements/runtime.server";

// Playback manifest of a scene discovered through nearby / anchors. Legacy
// organizations resolve the scene asset's current models; cut-over
// organizations compile the placement's fixed SceneRevision. Either way the
// manifest's assetId echoes the requested discovery id.
export async function POST(request: Request) {
  try {
    const body = await readJson(request);
    const assetId = requireUuid(body.asset_id, "asset_id");
    const workspaceId = optionalUuid(body.p_workspace_id, "p_workspace_id");
    const organizationId = optionalUuid(body.p_organization_id, "p_organization_id");
    if (!workspaceId && !organizationId) return json({ error: "缺少工作空间或组织" }, 400);
    const scope = await scopeState({ workspaceId, organizationId });
    if (!scope) return json({ error: "场景素材不存在" }, 404);
    if (scope.state === "v2") return json(await sceneManifest(assetId, { workspaceId, organizationId: scope.organizationId }));
    return json(await getSceneAsset(assetId, workspaceId, organizationId));
  } catch (error) {
    if (error instanceof SceneAssetError) return json({ error: error.message }, error.status);
    if (error instanceof RuntimeNotFound) return json({ error: error.message }, 404);
    return errorResponse(error);
  }
}
