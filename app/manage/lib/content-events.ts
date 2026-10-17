const EVENT = "team-content-changed";

export function notifyContentChange() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(EVENT));
  if (typeof BroadcastChannel !== "undefined") {
    const channel = new BroadcastChannel(EVENT);
    channel.postMessage(null);
    channel.close();
  }
}

export function subscribeContentChanges(refresh: () => void) {
  const channel = typeof BroadcastChannel !== "undefined" ? new BroadcastChannel(EVENT) : null;
  if (channel) channel.onmessage = refresh;
  window.addEventListener(EVENT, refresh);
  window.addEventListener("focus", refresh);
  return () => {
    channel?.close();
    window.removeEventListener(EVENT, refresh);
    window.removeEventListener("focus", refresh);
  };
}
