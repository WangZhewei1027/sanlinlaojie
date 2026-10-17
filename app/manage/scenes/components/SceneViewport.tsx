"use client";
import { groundPlacement, type PlacementReader } from "@/lib/scene/editor-interactions";
import type { CompositionInstance } from "@/lib/scene/protocol";
import type { TransformValues } from "@/lib/scene/theatre-state";
import { Bounds, Grid, Html, OrbitControls, TransformControls, useBounds, useGLTF, useHelper } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Suspense, useEffect, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import { AnimationAction, AnimationMixer, Box3, BoxHelper, Group, LoopOnce } from "three";
import { clone } from "three/examples/jsm/utils/SkeletonUtils.js";
import type { TheatreSession, TransformObject } from "./theatre-session";
import type { ClipInfo } from "./types";
const decoder = process.env.NEXT_PUBLIC_MEDIA_BASE_URL ? `${process.env.NEXT_PUBLIC_MEDIA_BASE_URL.replace(/\/+$/, "")}/static/draco/gltf/` : undefined;

type ModelProps = { url: string; instance: CompositionInstance; object: TransformObject; session: TheatreSession; onClips: (id: string, clips: ClipInfo[]) => void; onSelect: () => void; selected: boolean; editable: boolean; tool: "translate" | "rotate" | "scale"; onTransform: (id: string, values: TransformValues) => void; roots: Map<string, Group>; onReady: () => void };
function Model({ url, instance, object, session, onClips, onSelect, selected, editable, tool, onTransform, roots, onReady }: ModelProps) {
  const gltf = useGLTF(url, decoder);
  const model = useMemo(() => clone(gltf.scene), [gltf.scene]);
  const root = useRef<Group>(null);
  useHelper(selected ? root as React.RefObject<Group> : false, BoxHelper, "hsl(0, 0%, 25%)");
  useEffect(() => {
    if (root.current) roots.set(instance.id, root.current);
    onReady();
    return () => { roots.delete(instance.id); };
  }, [roots, instance.id, onReady]);
  const playback = useRef<{ mixer: AnimationMixer; action: AnimationAction } | null>(null);
  const clip = instance.animation ? (instance.animation.clipIndex !== undefined ? gltf.animations[instance.animation.clipIndex] : gltf.animations.find((item) => item.name === instance.animation?.clipName)) : undefined;
  useEffect(() => {
    onClips(instance.id, gltf.animations.map((animation) => ({ name: animation.name, duration: animation.duration })));
  }, [gltf.animations, instance.id, onClips]);
  useEffect(() => object.onValuesChange((value) => {
    root.current?.position.set(value.position.x, value.position.y, value.position.z);
    root.current?.rotation.set(value.rotation.x, value.rotation.y, value.rotation.z, "XYZ");
    root.current?.scale.set(value.scale.x, value.scale.y, value.scale.z);
  }), [object]);
  useEffect(() => {
    if (!clip) return;
    // Allocate together in the effect: React StrictMode may clean up and mount again.
    const mixer = new AnimationMixer(model);
    const action = mixer.clipAction(clip);
    action.setLoop(LoopOnce, 1); action.clampWhenFinished = true; action.play();
    playback.current = { mixer, action };
    return () => { action.stop(); mixer.stopAllAction(); mixer.uncacheRoot(model); playback.current = null; };
  }, [clip, model]);
  useEffect(() => () => { model.traverse((child) => { if ("isSkinnedMesh" in child && child.isSkinnedMesh) (child as import("three").SkinnedMesh).skeleton.dispose(); }); }, [model]);
  useFrame(() => {
    if (!playback.current || !clip || !instance.animation) return;
    const { action, mixer } = playback.current;
    const local = Math.max(0, session.sheet.sequence.position - instance.animation.startSeconds);
    action.time = instance.animation.loop && clip.duration > 0 ? local % clip.duration : Math.min(local, clip.duration);
    mixer.update(0);
  });
  const initial = object.value;
  return <>
    <group ref={root} position={[initial.position.x, initial.position.y, initial.position.z]} rotation={[initial.rotation.x, initial.rotation.y, initial.rotation.z]} scale={[initial.scale.x, initial.scale.y, initial.scale.z]} onClick={(event) => { event.stopPropagation(); onSelect(); }} dispose={null}><primitive object={model} /></group>
    {selected && editable && <TransformControls object={root as React.RefObject<Group>} mode={tool} size={0.8} onMouseUp={() => {
      const group = root.current;
      if (!group) return;
      const vector = (value: { x: number; y: number; z: number }) => ({ x: value.x, y: value.y, z: value.z });
      onTransform(instance.id, { position: vector(group.position), rotation: vector(group.rotation), scale: vector(group.scale) });
      // Reapply the accepted pose if validation rejected an out-of-bounds drag.
      const value = object.value;
      group.position.set(value.position.x, value.position.y, value.position.z);
      group.rotation.set(value.rotation.x, value.rotation.y, value.rotation.z);
      group.scale.set(value.scale.x, value.scale.y, value.scale.z);
    }} />}
  </>;
}

function FitController({ fitRef, roots }: { fitRef: React.RefObject<(() => void) | null>; roots: Map<string, Group> }) {
  const bounds = useBounds();
  const { width, height } = useThree((state) => state.size);
  useEffect(() => { fitRef.current = () => { const box = new Box3(); roots.forEach((group) => box.expandByObject(group)); if (!box.isEmpty()) bounds.refresh(box).clip().fit(); }; fitRef.current(); return () => { fitRef.current = null; }; }, [bounds, fitRef, roots, width, height]);
  return null;
}

function PlacementController({ placementRef }: { placementRef: React.RefObject<PlacementReader | null> }) {
  const { camera, gl } = useThree();
  useEffect(() => {
    placementRef.current = (x, y) => groundPlacement(camera, gl.domElement.getBoundingClientRect(), x, y);
    return () => { placementRef.current = null; };
  }, [camera, gl, placementRef]);
  return null;
}

export function SceneViewport({ session, instances, resolveUrl, onClips, fitRef, placementRef, selectedId, onSelect, grid, tool, editable, onTransform }: { placementRef: React.RefObject<PlacementReader | null>; fitRef: React.RefObject<(() => void) | null>; session: TheatreSession; instances: CompositionInstance[]; /** URL per instance: resolved by pinned version; a preview may override one instance. */ resolveUrl: (instance: CompositionInstance) => string | null | undefined; onClips: (id: string, clips: ClipInfo[]) => void; selectedId: string | null; onSelect: (id: string | null) => void; grid: boolean; editable: boolean; tool: "translate" | "rotate" | "scale"; onTransform: (id: string, values: TransformValues) => void }) {
  const { t } = useTranslation();
  const roots = useMemo(() => new Map<string, Group>(), []);
  const onReady = useMemo(() => () => { requestAnimationFrame(() => fitRef.current?.()); }, [fitRef]);
  return <Canvas camera={{ position: [5, 4, 7], fov: 45, near: 0.01, far: 2000 }} onPointerMissed={() => onSelect(null)}>
    <PlacementController placementRef={placementRef} />
    <ambientLight intensity={1.2} /><directionalLight position={[5, 8, 5]} intensity={2} />
    {grid && <><Grid args={[20, 20]} cellSize={1} sectionSize={5} fadeDistance={80} infiniteGrid cellColor="hsl(0, 0%, 80%)" sectionColor="hsl(0, 0%, 65%)" /><axesHelper args={[1]} /></>}
    <OrbitControls makeDefault target={[0, 1, 0]} />
    <Bounds margin={1.5}><FitController fitRef={fitRef} roots={roots} />{instances.map((instance) => {
      const url = resolveUrl(instance);
      const object = session.objects.get(instance.id);
      return url && object ? <Suspense key={instance.id} fallback={<Html center><span className="rounded bg-background p-2 text-sm">{t("sceneEditor.loadingModel")}</span></Html>}><Model url={url} instance={instance} object={object} session={session} onClips={onClips} onSelect={() => onSelect(instance.id)} selected={instance.id === selectedId} editable={editable} tool={tool} onTransform={onTransform} roots={roots} onReady={onReady} /></Suspense> : null;
    })}</Bounds>
  </Canvas>;
}
