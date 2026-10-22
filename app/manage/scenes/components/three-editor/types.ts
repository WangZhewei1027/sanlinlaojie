import type { RefObject } from 'react';
import type { PlacementReader } from '@/lib/scene/editor-interactions';
import type { CompositionInstance } from '@/lib/scene/protocol';
import type { SceneSession } from '../scene-session';
import type { ClipInfo } from '../types';
export interface ThreeViewportProps {
  session: SceneSession; instances: CompositionInstance[];
  resolveUrl(instance: CompositionInstance): string | null | undefined;
  onClips(id: string, clips: ClipInfo[]): void; onSelect(id: string | null): void;
  onTransform(id: string, group: "position" | "rotation" | "scale", value: import("@spatial-memory/scene-core").Vector): void; onError(message: string): void;
  fitRef: RefObject<(() => void) | null>; placementRef: RefObject<PlacementReader | null>;
  toolsRef: RefObject<HTMLDivElement | null>;
  selectedId: string | null; grid: boolean; editable: boolean; preview: boolean; language: string;
}
