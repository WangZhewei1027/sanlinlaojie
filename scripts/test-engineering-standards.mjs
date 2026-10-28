import assert from "node:assert/strict";
import { test } from "node:test";
import { ESLint } from "eslint";

// Exercise the real repository config, including its path-specific overrides.
const eslint = new ESLint();
async function errors(source, filePath, ruleId) {
  const [result] = await eslint.lintText(source, { filePath });
  assert.equal(result.fatalErrorCount, 0, JSON.stringify(result.messages));
  return result.messages.filter((message) => message.severity === 2 && message.ruleId === ruleId);
}

test("Radix primitives are allowed only inside components/ui, including .ts helpers", async () => {
  for (const file of ["app/example.tsx", "components/example.ts", "lib/example.ts"]) {
    for (const specifier of ["@radix-ui/react-dialog", "radix-ui", "radix-ui/internal"]) {
      assert.equal((await errors(`import * as Dialog from '${specifier}'; export { Dialog };`, file, "no-restricted-imports")).length, 1);
      assert.equal((await errors(`export * from '${specifier}';`, file, "no-restricted-imports")).length, 1);
      assert.equal((await errors(`import('${specifier}');`, file, "engineering/no-dynamic-radix")).length, 1);
    }
  }
  assert.equal((await errors("import * as Dialog from '@radix-ui/react-dialog'; export { Dialog };", "components/ui/example.tsx", "no-restricted-imports")).length, 0);
  assert.equal((await errors("import { Dialog } from '@/components/ui/dialog'; export { Dialog };", "app/example.tsx", "no-restricted-imports")).length, 0);
  assert.equal((await errors("require('radix-ui');", "lib/example.js", "no-restricted-modules")).length, 1);
  assert.equal((await errors("import(`radix-ui`);", "app/example.tsx", "engineering/no-dynamic-radix")).length, 1);
  assert.equal((await errors("import('@radix-ui/react-dialog');", "components/ui/example.tsx", "engineering/no-dynamic-radix")).length, 0);
});

test("server modules require a runtime server-only guard, not a comment or type import", async () => {
  for (const file of ["lib/example.server.ts", "lib/auth/server.ts", "lib/db/index.ts", "lib/storage/oss.ts", "lib/email.ts"]) {
    assert.equal((await errors("export const value = 1;", file, "engineering/require-server-only")).length, 1);
    assert.equal((await errors('import "server-only"; export const value = 1;', file, "engineering/require-server-only")).length, 0);
  }
  for (const source of ['// import "server-only";\nexport const value = 1;', 'import type {} from "server-only";']) {
    assert.equal((await errors(source, "lib/example.server.ts", "engineering/require-server-only")).length, 1);
  }
  assert.equal((await errors("export type Shape = { id: string };", "lib/contracts.ts", "engineering/require-server-only")).length, 0);
});

test("Scene Core remains portable and leaves scheduling and I/O to its hosts", async () => {
  const file = "packages/scene-core/index.js";
  for (const source of ["import 'three';", "import('node:fs');", "export * from 'three';"]) {
    assert.equal((await errors(source, file, "no-restricted-syntax")).length, 1);
  }
  for (const source of ["require('three');", "window.document;", "globalThis.fetch('/');", "wx.request({});", "setTimeout(() => {}, 1);", "requestAnimationFrame(() => {});", "process.env.NODE_ENV;"]) {
    assert.ok((await errors(source, file, "no-restricted-globals")).length > 0, source);
  }
  assert.equal((await errors("eval('1');", file, "no-eval")).length, 1);
  assert.equal((await errors("new Function('return 1');", file, "no-new-func")).length, 1);
  const [valid] = await eslint.lintText("module.exports = { sample: (time) => Math.max(0, time) };", { filePath: file });
  assert.equal(valid.errorCount, 0, JSON.stringify(valid.messages));
});
