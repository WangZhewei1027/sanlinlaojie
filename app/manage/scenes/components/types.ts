export interface ModelAsset { id: string; name: string | null; file_url: string | null }
export interface SceneEditorAsset { id: string; name: string | null; text_content: string; scene_revision: string }
export type ClipInfo = { name: string; duration: number };
