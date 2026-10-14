import { getSceneAsset } from "@/lib/scene/asset.server";
import { SceneAssetError } from "@/lib/scene/validate";
import { errorResponse, json, optionalUuid, readJson, requireUuid } from "@/lib/miniapp/request";

// Current content of a scene asset, resolved only when the ordinary asset queue loads it.
export async function POST(request: Request) {
  try {
    const body = await readJson(request);
    return json(await getSceneAsset(
      requireUuid(body.asset_id, "asset_id"),
      optionalUuid(body.p_workspace_id, "p_workspace_id"),
      optionalUuid(body.p_organization_id, "p_organization_id"),
    ));
  } catch (error) {
    if (error instanceof SceneAssetError) return json({ error: error.message }, error.status);
    return errorResponse(error);
  }
}
