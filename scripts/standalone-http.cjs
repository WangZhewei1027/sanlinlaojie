/* eslint-disable @typescript-eslint/no-require-imports -- Node preload runs before the generated CommonJS standalone entrypoint. */
const http = require("node:http");

// Next's standalone bootstrap creates its application HTTP server first and
// exposes only keepAliveTimeout, not the request-body receive deadline. A
// 512 MiB upload can exceed Node's default five minutes on ordinary uplinks.
// Apply this only to that first server, then restore the factory immediately.
const createServer = http.createServer;
http.createServer = function (...args) {
  http.createServer = createServer;
  const server = Reflect.apply(createServer, this, args);
  server.requestTimeout = 15 * 60 * 1000;
  // Keep the default header deadline; this is not a blanket timeout disable.
  server.headersTimeout = Math.min(server.headersTimeout, 60 * 1000);
  return server;
};
