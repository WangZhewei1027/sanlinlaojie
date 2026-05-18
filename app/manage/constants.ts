/**
 * Sentinel value indicating the user explicitly chose "All workspaces"
 * (i.e. operate at the organization scope, with no specific workspace).
 *
 * Using a string sentinel (rather than `null`) lets us distinguish
 * "no preference yet — auto-pick the first workspace" (`null`) from
 * "the user intentionally cleared the workspace filter" (`ALL_WORKSPACES_ID`),
 * while still fitting the existing `string | null` types.
 */
export const ALL_WORKSPACES_ID = "__all__";

/**
 * Returns true only for a real workspace UUID. Both `null` and the
 * `ALL_WORKSPACES_ID` sentinel return false.
 */
export function isSpecificWorkspaceId(
  id: string | null | undefined,
): id is string {
  return !!id && id !== ALL_WORKSPACES_ID;
}
