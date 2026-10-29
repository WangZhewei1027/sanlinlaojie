import { Vector4, type PerspectiveCamera, type Scene, type WebGLRenderer } from 'three';

type Rect = Pick<DOMRect, 'left' | 'top' | 'width' | 'height'>;
type InsetRenderer = Pick<WebGLRenderer, 'getViewport' | 'getScissor' | 'getScissorTest' | 'setViewport' | 'setScissor' | 'setScissorTest' | 'autoClear' | 'render'>;

/** Render the phone view into the existing canvas, preserving the editor's renderer and shading. */
export function renderPreviewInset(renderer: InsetRenderer, scene: Scene, camera: PerspectiveCamera, canvas: Rect, frame: Rect, withPresentation: (render: () => void) => void): boolean {
  if (![canvas.left, canvas.top, canvas.width, canvas.height, frame.left, frame.top, frame.width, frame.height].every(Number.isFinite) || canvas.width <= 0 || canvas.height <= 0 || frame.width <= 0 || frame.height <= 0) return false;
  const left = frame.left - canvas.left, bottom = canvas.height - (frame.top - canvas.top + frame.height);
  const clipLeft = Math.max(0, left), clipBottom = Math.max(0, bottom);
  const clipRight = Math.min(canvas.width, left + frame.width), clipTop = Math.min(canvas.height, bottom + frame.height);
  if (clipRight <= clipLeft || clipTop <= clipBottom) return false;
  const viewport = renderer.getViewport(new Vector4()), scissor = renderer.getScissor(new Vector4());
  const scissorTest = renderer.getScissorTest(), autoClear = renderer.autoClear, overrideMaterial = scene.overrideMaterial;
  camera.aspect = frame.width / frame.height; camera.updateProjectionMatrix();
  try {
    // Three's viewport/scissor APIs take logical pixels and apply the renderer pixel ratio.
    renderer.setViewport(left, bottom, frame.width, frame.height);
    renderer.setScissor(clipLeft, clipBottom, clipRight - clipLeft, clipTop - clipBottom);
    renderer.setScissorTest(true); renderer.autoClear = true;
    scene.overrideMaterial = null;
    withPresentation(() => renderer.render(scene, camera));
  } finally {
    scene.overrideMaterial = overrideMaterial;
    renderer.autoClear = autoClear;
    renderer.setViewport(viewport); renderer.setScissor(scissor); renderer.setScissorTest(scissorTest);
  }
  return true;
}
