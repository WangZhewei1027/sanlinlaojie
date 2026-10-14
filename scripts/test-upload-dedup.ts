/** Local HTTP regression: temporary records only; dedup hits never write to OSS. */
import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { loadEnvConfig } from "@next/env";
import { db, sql } from "@/lib/db";

async function main() {
  loadEnvConfig(process.cwd());
  assert.ok(["localhost", "127.0.0.1"].includes(new URL(process.env.DATABASE_URL!).hostname));
  const base = "http://localhost:3000";
  const email = `upload-dedup-${randomUUID()}@example.test`;
  const fixture = JSON.stringify({ asset: { version: "2.0" }, scenes: [{}], scene: 0 });
  const json = Buffer.from(fixture.padEnd(Math.ceil(fixture.length / 4) * 4, " "));
  const bytes = Buffer.alloc(20 + json.length);
  bytes.write("glTF"); bytes.writeUInt32LE(2, 4); bytes.writeUInt32LE(bytes.length, 8);
  bytes.writeUInt32LE(json.length, 12); bytes.writeUInt32LE(0x4e4f534a, 16); json.copy(bytes, 20);
  const hash = createHash("sha256").update(bytes).digest("hex");
  let userId: string | undefined;
  try {
    const signup = await fetch(`${base}/api/auth/sign-up/email`, {
      method: "POST", headers: { "Content-Type": "application/json", Origin: base },
      body: JSON.stringify({ email, password: randomUUID(), name: "Upload dedup regression" }),
    });
    const account = await signup.json();
    assert.equal(signup.status, 200, account.message);
    userId = account.user.id;
    const cookie = signup.headers.getSetCookie().map((v) => v.split(";")[0]).join("; ");
    assert.ok(cookie);
    const org = await db.selectFrom("organization").select("id").where("created_by", "=", userId!).executeTakeFirstOrThrow();
    const workspace = await db.selectFrom("workspace").select("id").where("organization_id", "=", org.id).executeTakeFirstOrThrow();
    const foreignOrg = await db.insertInto("organization").values({ name: "Foreign upload scope", created_by: userId }).returning("id").executeTakeFirstOrThrow();
    const foreignWorkspace = await db.insertInto("workspace").values({ name: "Foreign", organization_id: foreignOrg.id }).returning("id").executeTakeFirstOrThrow();
    const existingUrl = `https://example.test/${randomUUID()}.glb`;
    // Insert the foreign duplicate first to catch accidental cross-org reuse.
    await db.insertInto("asset").values([
      { file_type: "model", file_url: "https://example.test/foreign.glb", content_hash: hash, workspace_id: [foreignWorkspace.id] },
      { file_type: "model", file_url: existingUrl, content_hash: hash, workspace_id: [workspace.id] },
    ]).execute();
    const upload = (workspaceId: string, sessionCookie = cookie) => {
      const form = new FormData();
      form.set("file", new File([bytes], "box.glb", { type: "model/gltf-binary" }));
      form.set("type", "model"); form.set("workspace_id", workspaceId);
      return fetch(`${base}/api/upload`, { method: "POST", redirect: "manual", headers: { Cookie: sessionCookie, Origin: base }, body: form });
    };
    const assertReuse = async (workspaceId: string) => {
      const response = await upload(workspaceId);
      assert.equal(response.status, 200, await response.clone().text());
      assert.deepEqual(await response.json(), { url: existingUrl, contentHash: hash, storagePath: null });
    };
    await assertReuse(workspace.id); // A single UUID must still be bound as an array.
    const second = await db.insertInto("workspace").values({ name: "Second upload workspace", organization_id: org.id }).returning("id").executeTakeFirstOrThrow();
    await assertReuse(second.id); // Reuse across workspaces in the same organization.
    await assertReuse(workspace.id); // Multiple UUIDs must not become a SQL row value.
    assert.equal((await upload(foreignWorkspace.id)).status, 403);
    const anonymous = await upload(workspace.id, "");
    assert.equal(anonymous.status, 307);
    assert.equal(new URL(anonymous.headers.get("location")!, base).pathname, "/auth/login");
    console.log("PASS single/multiple workspace arrays, same-org reuse, no cross-org reuse, unauthorized denial");
  } finally {
    if (!userId) userId = (await sql<{ id: string }>`select id from auth.users where email = ${email}`.execute(db)).rows[0]?.id;
    if (userId) {
      const orgs = await db.selectFrom("organization").select("id").where("created_by", "=", userId).execute();
      const ids = orgs.map((org) => org.id);
      if (ids.length) {
        const workspaces = await db.selectFrom("workspace").select("id").where("organization_id", "in", ids).execute();
        if (workspaces.length) await db.deleteFrom("asset").where(sql<boolean>`workspace_id && ${workspaces.map((w) => w.id)}::uuid[]`).execute();
        await db.deleteFrom("workspace").where("organization_id", "in", ids).execute();
        await db.deleteFrom("organization_member").where("organization_id", "in", ids).execute();
        await db.deleteFrom("organization").where("id", "in", ids).execute();
      }
      await sql`delete from auth.users where id = ${userId}::uuid`.execute(db);
    }
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => db.destroy());
