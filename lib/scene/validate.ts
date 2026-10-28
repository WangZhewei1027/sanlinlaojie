import { MAX_SCENE_BYTES, SCENE_DOCUMENT_VERSION, SCENE_FLAT_SCHEMA_VERSION, SCENE_SCHEMA_VERSION, SCENE_PERFORMANCE_SCHEMA_VERSION, type SceneDefinition, type SceneDocument, type ValidationResult } from "./protocol";
import { IssueList, rejectUnknownKeys, requireObject } from "./validate-utils";
import { validateCompositionContent } from "./validate-content";

export class SceneAssetError extends Error {
  constructor(message: string, public readonly status = 400) {
    super(message);
  }
}

export function validateSceneDefinition(def: unknown): ValidationResult {
  const issues = new IssueList();
  const root = requireObject(issues, "$", def);
  if (root) {
    rejectUnknownKeys(issues, "$", root, ["schemaVersion", "content"]);
    const flat = root.schemaVersion === SCENE_FLAT_SCHEMA_VERSION;
    const performance = root.schemaVersion === SCENE_PERFORMANCE_SCHEMA_VERSION;
    if (!flat && !performance && root.schemaVersion !== SCENE_SCHEMA_VERSION) issues.error("schemaVersion", "播放清单必须是 schemaVersion 4、5 或 7");
    const content = requireObject(issues, "content", root.content);
    // Schema 4 is the flat format released mini-programs play; groups need schema 5.
    if (content?.kind === "composition") validateCompositionContent(issues, content, { groups: !flat, presentation: performance });
    else if (content) issues.error("content.kind", "场景素材仅支持 composition");
  }
  return { ok: !issues.hasErrors, issues: issues.issues };
}

export function parseSceneText(text: unknown): SceneDefinition {
  if (typeof text !== "string" || text.length > MAX_SCENE_BYTES || new TextEncoder().encode(text).length > MAX_SCENE_BYTES)
    throw new SceneAssetError("场景 JSON 必须是文本且不超过 1 MiB");
  let value: unknown;
  try { value = JSON.parse(text); }
  catch { throw new SceneAssetError("场景 JSON 格式错误"); }
  const result = validateSceneDefinition(value);
  if (!result.ok) throw new SceneAssetError(result.issues.filter((i) => i.severity === "error").slice(0, 3).map((i) => `${i.path}: ${i.message}`).join("；"));
  return value as SceneDefinition;
}

/** Internal schema 6: transform tracks, optional groups and direct asset references. */
export function validateSceneDocument(def: unknown): ValidationResult {
  const issues = new IssueList();
  const root = requireObject(issues, "$", def);
  if (root) {
    rejectUnknownKeys(issues, "$", root, ["schemaVersion", "content"]);
    if (root.schemaVersion !== SCENE_DOCUMENT_VERSION) issues.error("schemaVersion", "场景草稿必须是 schemaVersion 6");
    const content = requireObject(issues, "content", root.content);
    if (content?.kind === "composition") validateCompositionContent(issues, content);
    else if (content) issues.error("content.kind", "场景仅支持 composition");
  }
  if (!issues.hasErrors && new TextEncoder().encode(JSON.stringify(def)).length > MAX_SCENE_BYTES)
    issues.error("$", "场景 JSON 不能超过 1 MiB");
  return { ok: !issues.hasErrors, issues: issues.issues };
}

export function parseSceneDocument(value: unknown): SceneDocument {
  const result = validateSceneDocument(value);
  if (!result.ok) throw new SceneAssetError(result.issues.filter((i) => i.severity === "error").slice(0, 3).map((i) => `${i.path}: ${i.message}`).join("；"));
  return value as SceneDocument;
}
