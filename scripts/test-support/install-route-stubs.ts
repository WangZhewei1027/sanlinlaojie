/**
 * Test-only: replace exactly two modules with in-process doubles so real route
 * handlers run without a Next.js server, `.next` output or OSS
 * (scripts/test-team-workbench-routes.ts). Must run before anything imports them:
 *   lib/auth/server.ts → stub-auth-server.ts (session user set by the test)
 *   lib/storage/oss.ts → stub-oss.ts         (in-memory objects, no network)
 * Repo modules load as CommonJS under tsx, so a require.cache entry for the
 * real file path is what every later `@/lib/...` import resolves to. Never
 * referenced by application code.
 */
import Module from "node:module";
import path from "node:path";

const root = path.resolve(__dirname, "../..");

/** Call after the environment is prepared: the doubles load lib modules that read it at import time. */
export async function installRouteStubs(): Promise<void> {
  const stubs: [string, object][] = [
    ["lib/auth/server.ts", await import("./stub-auth-server")],
    ["lib/storage/oss.ts", await import("./stub-oss")],
  ];
  for (const [real, exports] of stubs) {
    const realPath = path.join(root, real);
    if (require.cache[realPath]) throw new Error(`${real} was loaded before the route stubs were installed`);
    const double = new Module(realPath);
    double.filename = realPath;
    double.exports = exports;
    double.loaded = true;
    require.cache[realPath] = double;
  }
}
