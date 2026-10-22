"use client";
import { createContext, useContext } from 'react';
import type { SceneNode } from '@/lib/scene/hierarchy-authoring';
import type { GridSteps } from './timeline-scale';
import type { KeySelection } from './timeline-keys';

/** Shared view state of one timeline: scale, playhead, selection and edit callbacks. */
export interface TimelineView {
  span: number; end: number; time: number; steps: GridSteps; disabled: boolean;
  text(zh: string, en: string): string;
  pct(time: number): string;
  /** Lane time under the pointer, snapped to the grid unless Alt/Option is held. */
  laneTime(event: { clientX: number; altKey: boolean }, lane: HTMLElement, max: number): number;
  selectedKey: KeySelection | null; selectKey(key: KeySelection | null): void;
  onSeek(time: number): void;
  onEditNode(id: string, edit: <N extends SceneNode>(node: N) => N): void;
}
export const TimelineContext = createContext<TimelineView | null>(null);
export function useTimeline() {
  const view = useContext(TimelineContext);
  if (!view) throw new Error('Timeline parts must render inside SceneTimeline');
  return view;
}
