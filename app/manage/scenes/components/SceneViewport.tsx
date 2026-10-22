"use client";
import { useEffect, useRef } from 'react';
import { mountThreeEditor } from './three-editor/mount';
import type { ThreeViewportProps } from './three-editor/types';

/** Upstream Three.js Editor owns rendering, picking, controls and its native toolbar. */
export function SceneViewport(props: ThreeViewportProps) {
  const host = useRef<HTMLDivElement>(null);
  const latest = useRef(props); latest.current = props;
  const active = useRef<ReturnType<typeof mountThreeEditor> | null>(null);
  useEffect(() => {
    const instance = mountThreeEditor(host.current!, latest.current);
    active.current = instance;
    return () => { active.current = null; instance.dispose(); };
  }, [props.session]);
  useEffect(() => { active.current?.update(props); });
  return <div ref={host} className="scene-three-viewport" data-three-editor="r183" aria-label="Three.js Editor" />;
}
