import { CanvasTexture, DoubleSide, Group, Mesh, MeshBasicMaterial, PlaneGeometry, SphereGeometry, SRGBColorSpace, TextureLoader, TorusGeometry, VideoTexture, type Material, type Texture } from 'three';
import type { CompositionInstance } from '@/lib/scene/protocol';
import type { SceneResourceKind } from '../types';
import { MediaPlayback } from './media-playback';

export interface SceneSurface {
  object: Group;
  materials: Material[];
  media?: MediaPlayback;
  audioMarker?: boolean;
  dispose(): void;
}

function plane(material: MeshBasicMaterial, width: number, height: number) {
  const mesh = new Mesh(new PlaneGeometry(1, 1), material);
  resizePlane(mesh, width, height);
  return mesh;
}

function resizePlane(mesh: Mesh, width: number, height: number) {
  mesh.scale.set(width, height, 1);
  mesh.position.y = height / 2;
}

function surface(object: Group, materials: Material[], texture?: Texture, media?: MediaPlayback): SceneSurface {
  return { object, materials, media, dispose() {
    media?.dispose();
    object.traverse(node => { if (node instanceof Mesh) node.geometry.dispose(); });
    materials.forEach(material => material.dispose());
    texture?.dispose();
  } };
}

/** Text is rasterized from the scene document; it never creates an asset or a managed file. */
export function textSurface(text: NonNullable<CompositionInstance['text']>): SceneSurface {
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas text rendering is unavailable');
  const fontPixels = 96;
  const rawWidth = Math.max(fontPixels, text.width / text.fontSize * fontPixels);
  const padding = fontPixels * 0.25;
  context.font = `500 ${fontPixels}px system-ui, sans-serif`;
  const lines: string[] = [];
  for (const paragraph of text.content.split('\n')) {
    let line = '';
    for (const character of paragraph) {
      if (line && context.measureText(line + character).width > rawWidth - padding * 2) { lines.push(line); line = ''; }
      line += character;
    }
    lines.push(line);
  }
  const lineHeight = fontPixels * 1.35;
  const rawHeight = lines.length * lineHeight + padding * 2;
  const density = Math.min(1, 4096 / rawWidth, 4096 / rawHeight);
  canvas.width = Math.max(1, Math.ceil(rawWidth * density));
  canvas.height = Math.max(1, Math.ceil(rawHeight * density));
  context.scale(density, density);
  context.font = `500 ${fontPixels}px system-ui, sans-serif`;
  context.textBaseline = 'middle';
  context.textAlign = text.align;
  if (text.backgroundColor) { context.fillStyle = text.backgroundColor; context.fillRect(0, 0, rawWidth, rawHeight); }
  context.fillStyle = text.color;
  const x = text.align === 'left' ? padding : text.align === 'right' ? rawWidth - padding : rawWidth / 2;
  lines.forEach((line, index) => context.fillText(line, x, padding + lineHeight * (index + 0.5)));
  const texture = new CanvasTexture(canvas); texture.colorSpace = SRGBColorSpace;
  const material = new MeshBasicMaterial({ map: texture, transparent: true, side: DoubleSide, depthWrite: false, toneMapped: false });
  const object = new Group(); object.add(plane(material, text.width, rawHeight / rawWidth * text.width));
  return surface(object, [material], texture);
}

/** Non-model resources have their own lifetime; URL changes dispose the old media before loading again. */
export function resourceSurface(kind: Exclude<SceneResourceKind, 'model'>, url: string, onError: (blocked?: boolean) => void): SceneSurface {
  const object = new Group();
  let closed = false;
  if (kind === 'image') {
    const material = new MeshBasicMaterial({ color: 0xffffff, transparent: true, side: DoubleSide, toneMapped: false });
    const mesh = plane(material, 2, 1.5); object.add(mesh);
    const texture = new TextureLoader().load(url, loaded => {
      if (closed) return;
      const source = loaded.image as { width: number; height: number };
      if (source.width > 0 && source.height > 0) resizePlane(mesh, 2, 2 * source.height / source.width);
    }, undefined, () => { if (!closed) onError(); });
    texture.colorSpace = SRGBColorSpace; material.map = texture;
    const result = surface(object, [material], texture);
    const dispose = result.dispose; result.dispose = () => { closed = true; dispose(); };
    return result;
  }
  const element = document.createElement(kind === 'video' ? 'video' : 'audio');
  element.crossOrigin = 'anonymous';
  element.preload = 'auto';
  // WeChat WebAudio resamples audio when changing speed; keep pitch semantics equal.
  element.preservesPitch = false;
  if (kind === 'video') (element as HTMLVideoElement).playsInline = true;
  const media = new MediaPlayback(element, onError);
  const failed = () => { if (!closed) onError(); };
  element.addEventListener('error', failed);
  let texture: VideoTexture | undefined;
  const materials: Material[] = [];
  let metadata: (() => void) | undefined;
  if (kind === 'video') {
    const video = element as HTMLVideoElement;
    texture = new VideoTexture(video); texture.colorSpace = SRGBColorSpace;
    const material = new MeshBasicMaterial({ map: texture, side: DoubleSide, toneMapped: false }); materials.push(material);
    const mesh = plane(material, 2, 1.125); object.add(mesh);
    metadata = () => { if (!closed && video.videoWidth > 0) resizePlane(mesh, 2, 2 * video.videoHeight / video.videoWidth); };
    element.addEventListener('loadedmetadata', metadata);
  } else {
    const material = new MeshBasicMaterial({ color: 0x586879, transparent: true, opacity: 0.8 }); materials.push(material);
    object.add(new Mesh(new SphereGeometry(0.12, 16, 12), material));
    for (const radius of [0.22, 0.34]) object.add(new Mesh(new TorusGeometry(radius, 0.012, 6, 36), material));
    object.position.y = 0.34;
  }
  element.src = url;
  element.load();
  const result = surface(object, materials, texture, media);
  result.audioMarker = kind === 'audio';
  const dispose = result.dispose;
  result.dispose = () => {
    closed = true;
    element.removeEventListener('error', failed);
    if (metadata) element.removeEventListener('loadedmetadata', metadata);
    dispose();
  };
  return result;
}
