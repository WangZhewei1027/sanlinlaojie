import type { ModelAnimationInfo } from "@/lib/content-model/contracts";
import type { SceneAssetManifest, SceneDocument } from "./protocol";

/** Compile a published layout with current asset resources into playback schema 2. */
export function compileSceneManifest(
  publicId: string,
  document: SceneDocument,
  resources: Record<string, { assetId: string; url: string }>,
): SceneAssetManifest {
  const assets: Record<string, { assetId: string }> = {};
  for (const [alias, ref] of Object.entries(document.content.assets)) {
    if (!resources[alias]) throw new Error(`scene resource ${alias} is not resolved`);
    assets[alias] = { assetId: ref.assetId };
  }
  return {
    assetId: publicId,
    schemaVersion: 2,
    content: { ...document.content, assets },
    resources,
  };
}

/**
 * Animation clips unavailable in current asset content (
 * block the save instead of silently dropping the animation). Assets with
 * an unknown clip list are not checked here; the player still verifies.
 */
export function clipIssues(
  document: Pick<SceneDocument, "content">,
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
      if (matches === 0) issues.push({ path, message: `素材没有动画 "${animation.clipName}"` });
      else if (matches > 1) issues.push({ path, message: `动画名 "${animation.clipName}" 在素材中不唯一，请改用序号` });
    } else if (animation.clipIndex !== undefined && !known.some((clip) => clip.index === animation.clipIndex)) {
      issues.push({ path, message: `素材没有第 ${animation.clipIndex} 个动画` });
    }
  });
  return issues;
}
