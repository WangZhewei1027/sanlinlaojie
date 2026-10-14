import { stateFromDefinition } from "./theatre-state";
import type { SceneDefinition } from "./protocol";

type SheetState = ReturnType<typeof stateFromDefinition>["sheetsById"]["Scene"];
type StudioBridge = {
  transaction: (edit: (api: { stateEditors: { coreByProject: { historic: { sheetsById: {
    _ensure: (address: { projectId: string; sheetId: string }) => SheetState;
  } } } } }) => void) => void;
};

/**
 * Theatre 0.7.2 has no public replace-state API. Keep its one required internal
 * boundary here (versions are pinned): import the same v0.4 sheet state that
 * getProject accepts. No private UI/DOM manipulation, project recreation or
 * duplicated interpolation. Our portable document owns undo and persistence.
 */
export function replaceTheatreSheet(projectId: string, definition: SceneDefinition) {
  const bridge = (globalThis as typeof globalThis & { __TheatreJS_StudioBundle?: { _studio?: StudioBridge } }).__TheatreJS_StudioBundle?._studio;
  if (!bridge?.transaction) throw new Error("Theatre 0.7.2 authoring bridge is unavailable. Reload the editor.");
  const imported = stateFromDefinition(definition).sheetsById.Scene;
  bridge.transaction(({ stateEditors }) => {
    const sheet = stateEditors.coreByProject.historic.sheetsById._ensure({ projectId, sheetId: "Scene" });
    sheet.staticOverrides = imported.staticOverrides;
    sheet.sequence = imported.sequence;
  });
}
