import { AnimationMixer, Group, LoopOnce, type AnimationAction, type AnimationClip, type Object3D } from 'three';
import { clone } from 'three/addons/utils/SkeletonUtils.js';
import { applyTransform, clipTime } from '@spatial-memory/scene-core';
import type { Editor } from '@/vendor/three-editor';
import type { CompositionInstance } from '@/lib/scene/protocol';
import { ModelPool, disposeModel } from './model-pool';
import { registerInstance } from './transform-bridge';
import type { ThreeViewportProps } from './types';

type Entry = { instance: CompositionInstance; url: string; release(): void; stop?: () => void; root?: Group; model?: Object3D; clips?: AnimationClip[]; mixer?: AnimationMixer; action?: AnimationAction; clip?: AnimationClip; animationKey?: string };
export class EditorModels {
  readonly entries = new Map<string, Entry>();
  constructor(private editor: Editor, private props: () => ThreeViewportProps, private dragging: (id: string) => boolean, private ready: () => void, private pool = new ModelPool()) {}
  sync() {
    const props = this.props();
    for (const [id, entry] of this.entries) {
      const current = props.instances.find(item => item.id === id);
      if (!current || props.resolveUrl(current) !== entry.url) this.remove(id);
    }
    for (const instance of props.instances) {
      const url = props.resolveUrl(instance);
      if (!url) continue;
      const existing = this.entries.get(instance.id);
      if (existing) { existing.instance = instance; this.animation(existing); continue; }
      const handle = this.pool.acquire(url);
      const entry: Entry = { instance, url, release: handle.release };
      this.entries.set(instance.id, entry);
      void handle.ready.then(gltf => {
        if (this.entries.get(instance.id) !== entry) return;
        const root = entry.root = new Group();
        root.name = instance.id; registerInstance(root, instance.id);
        const model = entry.model = clone(gltf.scene); root.add(model); entry.clips = gltf.animations;
        const object = this.props().session.sample(instance.id);
        if (!object) { this.remove(instance.id); return; }
        entry.stop = this.props().session.observe(instance.id, value => { if (!this.dragging(instance.id)) { applyTransform(root, value); if (this.editor.selected === root) this.editor.signals.objectChanged.dispatch(root); } });
        this.editor.addObject(root);
        this.animation(entry);
        this.props().onClips(instance.id, gltf.animations.map(clip => ({ name: clip.name, duration: clip.duration })));
        this.ready();
      }).catch(error => {
        if (this.entries.get(instance.id) !== entry) return;
        entry.release(); this.props().onError(`模型加载失败：${error instanceof Error ? error.message : String(error)}`);
      });
    }
  }
  private animation(entry: Entry) {
    if (!entry.model) return;
    const animation = entry.instance.animation;
    const key = JSON.stringify(animation);
    if (entry.animationKey === key) return;
    entry.mixer?.stopAllAction(); entry.mixer?.uncacheRoot(entry.model);
    entry.animationKey = key; entry.mixer = undefined; entry.action = undefined; entry.clip = undefined;
    if (!animation) return;
    const clip = animation.clipIndex !== undefined ? entry.clips?.[animation.clipIndex] : entry.clips?.find(item => item.name === animation.clipName);
    if (!clip) return;
    const mixer = entry.mixer = new AnimationMixer(entry.model);
    const action = entry.action = mixer.clipAction(clip); entry.clip = clip;
    action.setLoop(LoopOnce, 1); action.clampWhenFinished = true; action.play();
  }
  frame() {
    for (const entry of this.entries.values()) if (entry.action && entry.mixer && entry.clip && entry.instance.animation) {
      entry.action.time = clipTime(this.props().session.time, entry.instance.animation, entry.clip.duration);
      entry.mixer.update(0);
    }
  }
  remove(id: string) {
    const entry = this.entries.get(id); if (!entry) return;
    this.entries.delete(id); entry.stop?.();
    if (entry.model) { entry.mixer?.stopAllAction(); entry.mixer?.uncacheRoot(entry.model); disposeModel(entry.model); }
    if (entry.root) { if (this.editor.selected === entry.root) this.editor.select(null); this.editor.removeObject(entry.root); }
    entry.release();
    // Upstream removeObject keeps its geometry registry; rebuild it from live models.
    this.editor.geometries = {};
    this.editor.scene.traverse(node => { const geometry = (node as import('three').Mesh).geometry; if (geometry) this.editor.geometries[geometry.uuid] = geometry; });
  }
  dispose() { for (const id of [...this.entries.keys()]) this.remove(id); this.pool.dispose(); }
}
