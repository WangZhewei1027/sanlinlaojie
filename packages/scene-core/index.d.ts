export type Vector = { x: number; y: number; z: number };
export type TransformValues = { position: Vector; rotation: Vector; scale: Vector };
export type TransformChannel = `${keyof TransformValues}.${keyof Vector}`;
export type Keyframe = { time: number; value: number; handles: [number, number, number, number]; connectedRight: boolean };
export type Instance = { id: string; position: number[]; rotation: number[]; scale: number[]; tracks?: Partial<Record<TransformChannel, Keyframe[]>> };
export type Content = { durationSeconds: number | null; loop: boolean; instances: Instance[] };
export type TransformRoot = { position: { set(x: number, y: number, z: number): unknown }; rotation: { set(x: number, y: number, z: number, order?: 'XYZ'): unknown }; scale: { set(x: number, y: number, z: number): unknown } };
export function instanceValues(instance: Instance): TransformValues;
export function sampleInstance(instance: Instance, time: number): TransformValues;
export function sampleTrack(frames: Keyframe[] | undefined, time: number, fallback: number): number;
export function applyTransform(root: TransformRoot, values: TransformValues): void;
export function clipTime(time: number, animation: { startSeconds: number; loop: boolean }, duration: number): number;
export interface SceneCore {
 readonly time: number; readonly playing: boolean; readonly duration: number | null;
 sample(id: string): TransformValues | undefined;
 sync(content: Content): void;
 subscribe(callback: () => void): () => void;
 observe(id: string, callback: (value: TransformValues) => void): () => void;
 bind(id: string, root: TransformRoot): () => void;
 seek(position: number): void; pause(): void; play(loop?: boolean): void;
 advance(seconds: number): void; dispose(): void;
}
export function createSceneCore(options: { content: Content }): SceneCore;
