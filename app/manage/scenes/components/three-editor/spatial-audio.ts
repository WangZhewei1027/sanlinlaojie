type AudioRoute = { source: MediaElementAudioSourceNode; gain: GainNode; panner: StereoPannerNode };

/** One audio context per editor. Media stays on its progressive HTML stream. */
export class SpatialAudioMixer {
  private context?: AudioContext;
  private routes = new Map<HTMLMediaElement, AudioRoute>();
  private unavailable = false;
  private resuming = false;
  private blocked = false;
  private closed = false;

  private getContext() {
    if (this.closed || this.unavailable) return undefined;
    if (!this.context) {
      if (typeof AudioContext === 'undefined') { this.unavailable = true; return undefined; }
      try { this.context = new AudioContext(); } catch { this.unavailable = true; return undefined; }
      if (typeof this.context.createStereoPanner !== 'function') { this.unavailable = true; return undefined; }
    }
    return this.context;
  }

  /** Called at Play even for future cues, while the user's activation is still available. */
  unlock(onBlocked: () => void) {
    const context = this.getContext();
    if (!context || context.state === 'running' || context.state === 'closed' || this.resuming || this.blocked) return;
    this.resuming = true;
    void context.resume().catch(() => {
      if (!this.closed) { this.blocked = true; onBlocked(); }
    }).finally(() => { this.resuming = false; });
  }

  pause() { this.blocked = false; }

  apply(element: HTMLMediaElement, volume: number, pan: number, spatial: boolean, playing: boolean, onBlocked: () => void) {
    if (this.closed) return;
    let route = this.routes.get(element);
    if (!route && spatial && playing && !this.unavailable) {
      const context = this.getContext();
      if (context) {
        try {
          const gain = context.createGain(), panner = context.createStereoPanner();
          gain.connect(panner); panner.connect(context.destination);
          const source = context.createMediaElementSource(element);
          source.connect(gain);
          route = { source, gain, panner }; this.routes.set(element, route);
        } catch { this.unavailable = true; }
      }
    }
    if (!route) { element.volume = volume; return; }
    // Once connected, keep this element on the same route even when spatial audio is disabled.
    element.volume = 1;
    route.gain.gain.value = volume;
    route.panner.pan.value = spatial ? pan : 0;
    if (playing) this.unlock(onBlocked); else this.pause();
  }

  remove(element: HTMLMediaElement) {
    const route = this.routes.get(element);
    if (!route) return;
    route.source.disconnect(); route.gain.disconnect(); route.panner.disconnect();
    this.routes.delete(element);
  }

  dispose() {
    if (this.closed) return;
    this.closed = true;
    for (const element of this.routes.keys()) this.remove(element);
    if (this.context && this.context.state !== 'closed') void this.context.close().catch(() => {});
    this.context = undefined;
  }
}
