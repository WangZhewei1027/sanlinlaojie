// A successful Next build can still emit invalid JS when re-minifying Theatre.
// Parse, never execute, every classic browser chunk so the failure is caught in CI.
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { Script } from "node:vm";
let count = 0;
async function check(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) await check(path);
    else if (entry.name.endsWith(".js")) {
      try { new Script(await readFile(path, "utf8"), { filename: path }); count++; }
      catch (error) { console.error(`${path}: ${error.message}`); process.exitCode = 1; }
    }
  }
}
await check(".next/static/chunks");
if (!process.exitCode) console.log(`PASS syntax for ${count} client bundles`);
