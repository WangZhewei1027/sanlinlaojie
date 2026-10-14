/** Local HTTP integration: temporary owner, workspace and assets; never production. */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { loadEnvConfig } from "@next/env";
import { db, sql } from "@/lib/db";
import { createBlankScene } from "@/lib/scene/protocol";

async function main() {
  loadEnvConfig(process.cwd());
  assert.ok(["localhost", "127.0.0.1"].includes(new URL(process.env.DATABASE_URL!).hostname));
  const base = "http://localhost:3000";
  const email = `scene-editor-${randomUUID()}@example.test`;
  let userId: string | undefined;
  let orgId: string | undefined;
  try {
    const signup = await fetch(`${base}/api/auth/sign-up/email`, { method: "POST", headers: { "Content-Type": "application/json", Origin: base }, body: JSON.stringify({ email, password: randomUUID(), name: "Scene editor API regression" }) });
    const account = await signup.json();
    assert.equal(signup.status, 200, account.message);
    userId = account.user.id;
    const cookie = signup.headers.getSetCookie().map((value) => value.split(";")[0]).join("; ");
    assert.ok(cookie);
    const org = await db.selectFrom("organization").select("id").where("created_by", "=", userId!).executeTakeFirstOrThrow();
    orgId = org.id;
    const workspace = await db.selectFrom("workspace").select("id").where("organization_id", "=", orgId).executeTakeFirstOrThrow();
    const workspaceId = workspace.id;
    const request = (path: string, method = "GET", body?: unknown) => fetch(`${base}${path}`, { method, headers: { Cookie: cookie, Origin: base, "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
    const create = await request(`/api/workspaces/${workspaceId}/assets`, "POST", { file_type: "scene", name: "Title only" });
    assert.equal(create.status, 201, await create.clone().text());
    const { data: scene } = await create.json();
    assert.deepEqual(JSON.parse(scene.text_content), createBlankScene());
    const model = await db.insertInto("asset").values({ name: "Model fixture", workspace_id: [workspaceId], file_type: "model", file_url: "https://example.test/test.glb" }).returning("id").executeTakeFirstOrThrow();
    const privateModel = await db.insertInto("asset").values({ name: "Unavailable model", workspace_id: [], file_type: "model", file_url: "https://example.test/private.glb", created_by: userId }).returning("id").executeTakeFirstOrThrow();
    const read = await request(`/api/assets/${scene.id}`);
    assert.equal(read.status, 200, await read.clone().text());
    const initial = await read.json();
    assert.deepEqual(initial.models.map((item: { id: string }) => item.id), [model.id]);
    const definition = createBlankScene();
    definition.content.assets = { model: { assetId: model.id } };
    definition.content.instances = [{ id: "dancer", asset: "model", position: [0,0,0], quaternion: [0,0,0,1], scale: [1,1,1], animation: null, tracks: { "position.x": [{ time: 0, value: 0, handles: [0.5,0.5,0.5,0.5], connectedRight: true }, { time: 3, value: 2, handles: [0.5,0.5,0.5,0.5], connectedRight: false }] } }];
    const save = await request(`/api/assets/${scene.id}`, "PATCH", { name: "Arranged", text_content: JSON.stringify(definition), scene_revision: initial.data.scene_revision });
    assert.equal(save.status, 200, await save.clone().text());
    assert.equal((await request(`/api/assets/${scene.id}`, "PATCH", { name: "Stale", scene_revision: initial.data.scene_revision })).status, 409);
    const reopened = await (await request(`/api/assets/${scene.id}`)).json();
    assert.deepEqual(JSON.parse(reopened.data.text_content), definition);
    assert.equal(reopened.data.name, "Arranged");
    definition.content.assets.model.assetId = privateModel.id;
    assert.equal((await request(`/api/assets/${scene.id}`, "PATCH", { text_content: JSON.stringify(definition) })).status, 400);
    assert.equal((await request(`/api/workspaces/${workspaceId}/assets`, "POST", { file_type: "scene", name: " " })).status, 400);
    const secondOrg = await db.insertInto("organization").values({ name: "Other scene scope", created_by: userId }).returning("id").executeTakeFirstOrThrow();
    const secondWorkspace = await db.insertInto("workspace").values({ name: "Other", organization_id: secondOrg.id }).returning("id").executeTakeFirstOrThrow();
    await db.updateTable("asset").set({ workspace_id: [workspaceId, secondWorkspace.id] }).where("id", "=", scene.id).execute();
    assert.equal((await request(`/api/assets/${scene.id}`)).status, 403, "write access required in every organization");
    await db.updateTable("asset").set({ workspace_id: [workspaceId] }).where("id", "=", scene.id).execute();
    await db.updateTable("organization_member").set({ role: "viewer" }).where("organization_id", "=", orgId).where("user_id", "=", userId!).execute();
    assert.equal((await request(`/api/assets/${scene.id}`)).status, 403);
    assert.equal((await request(`/api/assets/${scene.id}`, "PATCH", { name: "Viewer write" })).status, 403);
    await db.deleteFrom("asset").where("id", "=", privateModel.id).execute();
    console.log("PASS title-only create, model scope, timeline save/reopen, stale-tab 409, invalid dependency, cross-org/viewer denial");
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
      await db.deleteFrom("asset").where("created_by", "=", userId).execute();
      await sql`delete from auth.users where id = ${userId}::uuid`.execute(db);
    }
    await db.destroy();
  }
}
main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => db.destroy());
