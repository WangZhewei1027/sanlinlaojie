"use client";

import { useCallback, useState } from "react";
import type { ContentActionResult } from "./types";

export type ContentActionFailure = Extract<ContentActionResult, { ok: false }>;

/**
 * Runs one async content callback at a time and keeps its failure for display.
 * Thrown errors become a generic failure so a rejected promise never escapes.
 */
export function useContentAction() {
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState<ContentActionFailure | null>(null);

  const run = useCallback(async (action: () => Promise<ContentActionResult | void>) => {
    setPending(true);
    setFailure(null);
    try {
      const result = await action();
      if (result && !result.ok) {
        setFailure(result);
        return false;
      }
      return true;
    } catch (error) {
      setFailure({ ok: false, kind: "error", message: error instanceof Error ? error.message : undefined });
      return false;
    } finally {
      setPending(false);
    }
  }, []);

  const reset = useCallback(() => setFailure(null), []);
  return { run, pending, failure, reset };
}
