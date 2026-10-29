import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import test from "node:test";

test("production preload gives the real HTTP server a 15-minute upload window without changing later servers", () => {
  const preload = fileURLToPath(new URL("./standalone-http.cjs", import.meta.url));
  const result = JSON.parse(execFileSync(process.execPath, ["--require", preload, "-e", `
    const http = require('node:http');
    const wrapped = http.createServer;
    const listener = () => {};
    const application = http.createServer(listener);
    const restored = http.createServer;
    const later = http.createServer({ keepAliveTimeout: 1234 });
    console.log(JSON.stringify({
      application: { request: application.requestTimeout, headers: application.headersTimeout,
        keepAlive: application.keepAliveTimeout, socket: application.timeout },
      preservesListener: application.listeners('request')[0] === listener,
      factoryRestored: wrapped !== restored && http.createServer === restored,
      later: { request: later.requestTimeout, headers: later.headersTimeout, keepAlive: later.keepAliveTimeout }
    }));
  `], { encoding: "utf8" }));
  assert.deepEqual(result, {
    application: { request: 900000, headers: 60000, keepAlive: 5000, socket: 0 },
    preservesListener: true,
    factoryRestored: true,
    later: { request: 300000, headers: 60000, keepAlive: 1234 },
  });

  const dockerfile = readFileSync(new URL("../Dockerfile", import.meta.url), "utf8");
  assert.match(dockerfile, /COPY[^\n]*scripts\/standalone-http\.cjs\s+\.\//);
  assert.match(dockerfile, /CMD \["node", "--require", "\.\/standalone-http\.cjs", "server\.js"\]/,
    "production must preload before the generated standalone entrypoint");
});
