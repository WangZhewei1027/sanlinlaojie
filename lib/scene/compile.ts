import type { ModelAnimationInfo } from "@/lib/content-model/contracts";
import type { CompositionInstance, SceneAssetManifest, SceneDocumentV3 } from "./protocol";

/**
 * Compile a fixed schema-3 document into the playback protocol the current
 * mini-program understands (schema 1/2). Instances and tracks are kept; every
 * alias resolves to the file of its pinned version. Never reads an asset's
 * current version.
 */
export function compileSceneManifest(
  publicId: string,
  document: SceneDocumentV3,
  resources: Record<string, { assetId: string; url: string }>,
): SceneAssetManifest {
  const assets: Record<string, { assetId: string }> = {};
  for (const [alias, ref] of Object.entries(document.content.assets)) {
    if (!resources[alias]) throw new Error(`scene resource ${alias} is not resolved`);
    assets[alias] = { assetId: ref.assetId };
  }
  const hasTracks = document.content.instances.some((instance) => instance.tracks && Object.keys(instance.tracks).length > 0);
  const instances: CompositionInstance[] = document.content.instances.map((instance) => {
    const { tracks, ...rest } = instance;
    return hasTracks && tracks && Object.keys(tracks).length ? { ...rest, tracks } : rest;
  });
  return {
    assetId: publicId,
    schemaVersion: hasTracks ? 2 : 1,
    content: { ...document.content, assets, instances },
    resources,
  };
}

/**
 * Animation clips that no longer exist in the pinned version (plan §5.2:
 * block the save instead of silently dropping the animation). Versions with
 * an unknown clip list are not checked here; the player still verifies.
 */
export function clipIssues(
  document: SceneDocumentV3,
  animationsByAlias: Record<string, ModelAnimationInfo[] | undefined>,
): { path: string; message: string }[] {
  const issues: { path: string; message: string }[] = [];
  document.content.instances.forEach((instance, index) => {
    const animation = instance.animation;
    const known = animationsByAlias[instance.asset];
    if (!animation || !known) return;
    const path = `content.instances[${index}].animation`;
    if (animation.clipName !== undefined) {
      const matches = known.filter((clip) => clip.name === animation.clipName).length;
      if (matches === 0) issues.push({ path, message: `所选版本没有动画 "${animation.clipName}"` });
      else if (matches > 1) issues.push({ path, message: `动画名 "${animation.clipName}" 在所选版本中不唯一，请改用序号` });
    } else if (animation.clipIndex !== undefined && !known.some((clip) => clip.index === animation.clipIndex)) {
      issues.push({ path, message: `所选版本没有第 ${animation.clipIndex} 个动画` });
    }
  });
  return issues;
}
