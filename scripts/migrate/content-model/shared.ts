import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { Client } from "pg";

export interface MigrationOptions {
  environment: "local" | "staging" | "production";
  organizations: string[];
  runId: string;
  apply: boolean;
  input?: string;
  output?: string;
}

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Migration tools deliberately never load .env.local or infer a target. */
export function options(args = process.argv.slice(2)): MigrationOptions {
  const values = new Map<string, string>();
  let apply = false;
  for (let i = 0; i < args.length; i++) {
    const key = args[i];
    if (key === "--apply") { apply = true; continue; }
    if (!["--environment", "--organizations", "--run-id", "--input", "--output"].includes(key)) {
      throw new Error(`Unknown argument ${key}`);
    }
    if (!args[i + 1] || args[i + 1].startsWith("--") || values.has(key)) throw new Error(`Missing or repeated ${key}`);
    values.set(key, args[++i]);
  }
  const environment = values.get("--environment");
  if (environment !== "local" && environment !== "staging" && environment !== "production") {
    throw new Error("Set --environment local|staging|production and an explicit DATABASE_URL");
  }
  const organizations = [...new Set((values.get("--organizations") ?? "").split(",").filter(Boolean))].sort();
  if (!organizations.length || organizations.some((id) => !UUID.test(id))) throw new Error("--organizations requires comma-separated UUIDs");
  const runId = values.get("--run-id") ?? "";
  if (!UUID.test(runId)) throw new Error("--run-id requires an explicit UUID");
  return { environment, organizations, runId, apply, input: values.get("--input"), output: values.get("--output") };
}

export async function connect(opts: MigrationOptions): Promise<Client> {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL must be explicitly set; environment files are not loaded");
  const url = new URL(process.env.DATABASE_URL);
  if (opts.environment === "local" && !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)) {
    throw new Error("--environment local requires a localhost database");
  }
  const client = new Client({ connectionString: process.env.DATABASE_URL, application_name: `content-model-${opts.runId}` });
  await client.connect();
  await client.query("set statement_timeout = '60s'");
  await client.query("set lock_timeout = '10s'");
  return client;
}

export function canonical(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (value instanceof Date) return JSON.stringify(value.toISOString());
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  return `{${Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, entry]) => `${JSON.stringify(key)}:${canonical(entry)}`).join(",")}}`;
}

export const fingerprint = (value: unknown): string => createHash("sha256").update(canonical(value)).digest("hex");

export function readJson<T>(path: string): T { return JSON.parse(readFileSync(resolve(path), "utf8")) as T; }

export function output(value: unknown, path?: string): void {
  const text = `${JSON.stringify(value, null, 2)}\n`;
  if (path) {
    const file = resolve(path);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, text, { mode: 0o600 });
    console.log(`Wrote ${file}`);
  } else process.stdout.write(text);
}

/** Errors must not print a connection URL, query parameters or driver details. */
export function fail(error: unknown): void {
  const message = error instanceof Error ? error.message : "Migration failed";
  console.error(message.replace(/postgres(?:ql)?:\/\/\S+/gi, "[database URL redacted]"));
  process.exitCode = 1;
}
