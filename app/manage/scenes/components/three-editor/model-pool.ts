import { Texture, type Material, type Object3D, type SkinnedMesh, type BufferGeometry } from 'three';
import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';

export function disposeModel(root: Object3D, shared = false) {
  const geometries = new Set<BufferGeometry>(), materials = new Set<Material>(), textures = new Set<Texture>();
  root.traverse(node => {
    const mesh = node as SkinnedMesh;
    mesh.skeleton?.dispose();
    if (!shared) return;
    if (mesh.geometry) geometries.add(mesh.geometry);
    for (const material of Array.isArray(mesh.material) ? mesh.material : mesh.material ? [mesh.material] : []) {
      materials.add(material);
      for (const value of Object.values(material)) if (value instanceof Texture) textures.add(value);
    }
  });
  geometries.forEach(item => item.dispose()); materials.forEach(item => item.dispose());
  textures.forEach(item => { item.dispose(); const image = item.source?.data; if (typeof ImageBitmap !== 'undefined' && image instanceof ImageBitmap) image.close(); });
}
/** Cache belongs to this viewport, including in-flight loads; no global useGLTF retention. */
export class ModelPool {
  private entries = new Map<string, { refs: number; promise: Promise<GLTF>; gltf?: GLTF }>();
  private loader = new GLTFLoader();
  private draco = new DRACOLoader();
  private closed = false;
  constructor(load?: (url: string) => Promise<GLTF>) {
    const media = process.env.NEXT_PUBLIC_MEDIA_BASE_URL;
    if (media) { this.draco.setDecoderPath(`${media.replace(/\/+$/, '')}/static/draco/gltf/`); this.loader.setDRACOLoader(this.draco); }
    this.load = load ?? (url => this.loader.loadAsync(url));
  }
  private load: (url: string) => Promise<GLTF>;
  acquire(url: string) {
    if (this.closed) throw new Error('Viewport has closed');
    let entry = this.entries.get(url);
    if (!entry) {
      entry = { refs: 0, promise: Promise.resolve().then(() => this.load(url)) };
      const created = entry;
      created.promise = created.promise.then(gltf => { created.gltf = gltf; if (created.refs === 0) disposeModel(gltf.scene, true); return gltf; });
      this.entries.set(url, created);
    }
    entry.refs++;
    const current = entry;
    let released = false;
    return { ready: current.promise, release: () => {
      if (released) return; released = true;
      if (--current.refs === 0) {
        if (this.entries.get(url) === current) this.entries.delete(url);
        if (current.gltf) disposeModel(current.gltf.scene, true);
      }
    } };
  }
  dispose() { this.closed = true; this.draco.dispose(); }
}
