"use client";
import { useCallback, useEffect, useState } from "react";
import { subscribeContentChanges } from "../../lib/content-events";

/** Abort obsolete reads when switching teams or record pages. */
export function useActivityQuery<T>(key: string | null, load: (signal: AbortSignal) => Promise<T>, live = true) {
  const [result, setResult] = useState<{ key: string; data: T | null; error: unknown } | null>(null);
  const [nonce, setNonce] = useState(0);
  const reload = useCallback(() => setNonce((value) => value + 1), []);
  useEffect(() => {
    if (!key) return;
    const abort = new AbortController();
    load(abort.signal).then((data) => {
      if (!abort.signal.aborted) setResult({ key, data, error: null });
    }).catch((error: unknown) => {
      if (!abort.signal.aborted) setResult({ key, data: null, error });
    });
    return () => abort.abort();
  }, [key, load, nonce]);
  useEffect(() => live ? subscribeContentChanges(reload) : undefined, [live, reload]);
  const current = result?.key === key ? result : null;
  return { data: current?.data ?? null, error: current?.error ?? null, loading: !!key && !current, reload };
}
