import type { ValidationResult } from "../../../lib/scene/protocol";
import type { LegacyContent } from "../legacy-theatre-state";
import { validateCompositionContent } from "./validate-legacy-scene";
import { IssueList, rejectUnknownKeys, requireObject } from "../../../lib/scene/validate-utils";

export interface LegacySceneDefinition {
  schemaVersion: 1 | 2;
  content: LegacyContent;
}

/** Historical scene reader, used only by the one-time data migration. */
export function validateLegacySceneDefinition(def: unknown): ValidationResult {
  const issues = new IssueList();
  const root = requireObject(issues, "$", def);
  if (root) {
    rejectUnknownKeys(issues, "$", root, ["schemaVersion", "content"]);
    if (root.schemaVersion !== 1 && root.schemaVersion !== 2) issues.error("schemaVersion", "仅支持旧场景 schemaVersion 1 或 2");
    const content = requireObject(issues, "content", root.content);
    if (content?.kind === "composition") validateCompositionContent(issues, content, root.schemaVersion === 2);
    else if (content) issues.error("content.kind", "场景仅支持 composition");
  }
  return { ok: !issues.hasErrors, issues: issues.issues };
}

export interface SceneDocumentV3 {
  schemaVersion: 3;
  content: LegacyContent<{ assetId: string; assetVersionId: string }>;
}
