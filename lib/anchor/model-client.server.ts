import "server-only";
import { Agent, FormData, fetch } from "undici";

/**
 * HTTP client for the SAGE model service (PAI-EAS).
 *
 * Node's built-in fetch closes idle connections after 4 s. Recognition pauses
 * for longer than that after every match (3 s warm-up plus the user moving),
 * so the first round after each restart used to open a new connection —
 * including a TLS handshake on the public endpoint (~40 ms, measured
 * 2026-10-08). A dedicated keep-alive agent holds idle connections for
 * 150 s, just under the EAS gateway (Envoy), which closes them after ~180 s
 * (measured 186 s on 2026-10-08) — closing ours first avoids reusing a socket
 * the gateway is about to drop.
 *
 * In production SAGE_EAS_ENDPOINT points at the VPC endpoint
 * (http://<uid>.vpc.cn-shanghai.pai-eas.aliyuncs.com/…), reachable from the
 * Shanghai server over Aliyun's internal network without TLS.
 */

const KEEP_ALIVE_MS = 150_000;

const agent = new Agent({
  keepAliveTimeout: KEEP_ALIVE_MS,
  keepAliveMaxTimeout: KEEP_ALIVE_MS,
  connections: 16,
});

// Errors raised when a pooled connection was closed by the other side just
// before reuse. Embedding is idempotent, so one retry on a fresh connection
// is safe.
const RETRYABLE = new Set([
  "UND_ERR_SOCKET",
  "UND_ERR_CLOSED",
  "ECONNRESET",
  "EPIPE",
]);

function isStaleConnection(error: unknown): boolean {
  const cause = (error as { cause?: { code?: string } })?.cause;
  const code = cause?.code ?? (error as { code?: string })?.code;
  return typeof code === "string" && RETRYABLE.has(code);
}

/** POST an image to the model's /embed endpoint. */
export async function postEmbed(
  image: Blob,
  headers: Record<string, string>,
  timeoutMs = 25_000,
) {
  const url = `${process.env.SAGE_EAS_ENDPOINT!.replace(/\/$/, "")}/embed`;
  const send = () => {
    const form = new FormData();
    form.set("image", image, "image");
    return fetch(url, {
      method: "POST",
      headers,
      body: form,
      dispatcher: agent,
      signal: AbortSignal.timeout(timeoutMs),
      redirect: "error",
    });
  };
  try {
    return await send();
  } catch (error) {
    if (!isStaleConnection(error)) throw error;
    return send();
  }
}
