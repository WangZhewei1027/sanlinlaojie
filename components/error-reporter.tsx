"use client";

import { useEffect } from "react";

interface ClientErrorPayload {
  method: string;
  path: string;
  status: number;
  message: string;
  context: Record<string, unknown>;
}

function report(payload: ClientErrorPayload) {
  try {
    fetch("/api/errors", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      keepalive: true,
    }).catch(() => {});
  } catch {
    // ignore
  }
}

/**
 * Global client-side error capture. Mounted once in the root layout.
 * Reports uncaught runtime errors and unhandled promise rejections to
 * /api/errors so they land in error_log alongside API/fetch failures.
 *
 * Note: console.error is intentionally NOT hooked — thrown errors already
 * surface via the `error` event, and React funnels render errors to
 * console.error too, so hooking it would double-log and add noise.
 */
export function ErrorReporter() {
  useEffect(() => {
    // dedup identical errors within this session to avoid floods
    const seen = new Set<string>();
    const once = (key: string) => {
      if (seen.has(key)) return false;
      seen.add(key);
      if (seen.size > 100) seen.clear();
      return true;
    };

    const onError = (e: ErrorEvent) => {
      const message = e.message || String(e.error ?? "unknown error");
      if (!once(`${message}|${e.filename}|${e.lineno}`)) return;
      report({
        method: "window.error",
        path: location.pathname,
        status: 0,
        message,
        context: {
          stack:
            e.error instanceof Error
              ? e.error.stack?.slice(0, 4000)
              : undefined,
          filename: e.filename,
          line: e.lineno,
          col: e.colno,
          ua: navigator.userAgent,
        },
      });
    };

    const onRejection = (e: PromiseRejectionEvent) => {
      const reason = e.reason;
      const message =
        reason instanceof Error ? reason.message : String(reason);
      if (!once(`rejection|${message}`)) return;
      report({
        method: "unhandledrejection",
        path: location.pathname,
        status: 0,
        message,
        context: {
          stack: reason instanceof Error ? reason.stack?.slice(0, 4000) : undefined,
          ua: navigator.userAgent,
        },
      });
    };

    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);

  return null;
}
