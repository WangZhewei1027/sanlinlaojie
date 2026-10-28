import { mediaTime, samplePresentation } from '@spatial-memory/scene-core';
import type { CompositionInstance } from '@/lib/scene/protocol';

/** A single media element belongs to one scene instance, including its pending play request. */
export class MediaPlayback {
  private pending = false;
  private blocked = false;
  private closed = false;
  private wasPlaying = false;
  private desiredPlaying = false;

  constructor(readonly element: HTMLMediaElement, private onError: (blocked: boolean) => void) {}

  sync(instance: CompositionInstance, time: number, playing: boolean, duration: number | null) {
    if (this.closed) return;
    const presentation = samplePresentation(instance, time, duration);
    const settings = instance.media;
    const sourceDuration = Number.isFinite(this.element.duration) ? this.element.duration : undefined;
    const target = mediaTime(time, settings, instance.timing, sourceDuration);
    const trimStart = Math.min(settings?.trimStartSeconds ?? 0, sourceDuration ?? Infinity);
    const trimEnd = Math.min(settings?.trimEndSeconds ?? Infinity, sourceDuration ?? Infinity);
    const local = Math.max(0, time - (instance.timing?.startSeconds ?? 0)) * (settings?.playbackRate ?? 1);
    const emptyRange = Number.isFinite(trimEnd) && trimEnd <= trimStart;
    const ended = emptyRange || (!settings?.loop && Number.isFinite(trimEnd) && local >= trimEnd - trimStart);
    const shouldPlay = playing && presentation.visible && !ended;
    this.desiredPlaying = shouldPlay;
    if (!playing) this.blocked = false;
    this.element.volume = Math.max(0, Math.min(1, (settings?.volume ?? 1) * presentation.opacity));
    this.element.muted = settings?.muted ?? false;
    this.element.playbackRate = settings?.playbackRate ?? 1;
    // The scene owns loops, including trims. Native looping would include the entire file.
    this.element.loop = false;
    const threshold = playing && this.wasPlaying ? 0.15 : 0.015;
    if (this.element.readyState >= 1 && Math.abs(this.element.currentTime - target) > threshold) {
      try { this.element.currentTime = target; } catch { /* A stream may not expose seekable data yet. */ }
    }
    this.wasPlaying = shouldPlay;
    if (!shouldPlay) { if (!this.element.paused) this.element.pause(); return; }
    if (!this.element.paused || this.pending || this.blocked) return;
    this.pending = true;
    void this.element.play().then(() => {
      if (this.closed || !this.desiredPlaying) this.element.pause();
    }).catch((error: unknown) => {
      if (this.closed || !this.desiredPlaying) return;
      // Seeking while a play request is loading may abort it; the next frame retries.
      if (error instanceof Error && error.name === 'AbortError') return;
      this.blocked = true;
      this.onError(error instanceof Error && error.name === 'NotAllowedError');
    }).finally(() => { this.pending = false; });
  }

  dispose() {
    if (this.closed) return;
    this.closed = true;
    this.desiredPlaying = false;
    this.element.pause();
    this.element.removeAttribute('src');
    this.element.load();
  }
}
