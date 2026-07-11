"use client";

import { useEffect } from "react";

/**
 * Root error boundary — catches render crashes that bubble past all segment
 * boundaries (replaces the whole document when it renders). Reports to
 * /api/errors, then offers a reload.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    try {
      fetch("/api/errors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          method: "react.global-error",
          path: typeof location !== "undefined" ? location.pathname : null,
          status: 500,
          message: error.message || "render crash",
          context: {
            stack: error.stack?.slice(0, 4000),
            digest: error.digest,
            ua:
              typeof navigator !== "undefined" ? navigator.userAgent : undefined,
          },
        }),
        keepalive: true,
      }).catch(() => {});
    } catch {
      // ignore
    }
  }, [error]);

  return (
    <html lang="zh">
      <body
        style={{
          fontFamily: "system-ui, sans-serif",
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div style={{ textAlign: "center", padding: "2rem" }}>
          <h1 style={{ fontSize: "1.25rem", marginBottom: "0.5rem" }}>
            页面出错了
          </h1>
          <p style={{ color: "#666", marginBottom: "1.25rem" }}>
            我们已记录该错误，请重试。
          </p>
          <button
            onClick={reset}
            style={{
              padding: "0.5rem 1.25rem",
              borderRadius: "8px",
              border: "1px solid #ccc",
              background: "#111",
              color: "#fff",
              cursor: "pointer",
            }}
          >
            重试
          </button>
        </div>
      </body>
    </html>
  );
}
