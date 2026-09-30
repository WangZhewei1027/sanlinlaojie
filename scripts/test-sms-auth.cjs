/* eslint-disable @typescript-eslint/no-require-imports -- Node CommonJS test harness loads real TypeScript modules in memory. */
// Run with: node --test scripts/test-sms-auth.cjs
// Transpile the real server actions in memory; Supabase admin and Aliyun SDK are fakes.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");
const root = path.resolve(__dirname, "..");

process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role-key";

function loader(mocks = {}) {
  const cache = new Map();
  function load(relative) {
    const filename = path.join(root, relative);
    if (cache.has(filename)) return cache.get(filename).exports;
    const mod = new Module(filename, module);
    cache.set(filename, mod);
    mod.filename = filename;
    mod.paths = Module._nodeModulePaths(path.dirname(filename));
    const standard = mod.require.bind(mod);
    mod.require = (name) => {
      if (name in mocks) return mocks[name];
      if (name.startsWith("@/")) return load(name.slice(2) + ".ts");
      return standard(name);
    };
    mod._compile(
      ts.transpileModule(fs.readFileSync(filename, "utf8"), {
        compilerOptions: {
          module: ts.ModuleKind.CommonJS,
          target: ts.ScriptTarget.ES2022,
          esModuleInterop: true,
        },
      }).outputText,
      filename,
    );
    return mod.exports;
  }
  return load;
}

const PHONE = "13800138000";
const EMAIL = `${PHONE}@phone.sanlinlaojie.local`;

function fakeAdmin(users) {
  const calls = { listUsers: [], updateUserById: [], createUser: [] };
  const admin = {
    listUsers: async ({ page, perPage } = {}) => {
      calls.listUsers.push({ page, perPage });
      if (!perPage) return { data: { users: users.slice(0, 50) }, error: null };
      const start = (page - 1) * perPage;
      return { data: { users: users.slice(start, start + perPage) }, error: null };
    },
    updateUserById: async (id, attrs) => {
      calls.updateUserById.push({ id, attrs });
      return { error: null };
    },
    createUser: async (attrs) => {
      calls.createUser.push(attrs);
      return { data: { user: { id: "new-user" } }, error: null };
    },
  };
  return { calls, client: { auth: { admin } } };
}

function loadSms({ users = [], verifyResult = "PASS" } = {}) {
  const admin = fakeAdmin(users);
  class Request {
    constructor(value) {
      Object.assign(this, value);
    }
  }
  const load = loader({
    "@/lib/supabase/admin": { createAdminClient: () => admin.client },
    "@alicloud/dypnsapi20170525": {
      __esModule: true,
      default: class {
        async checkSmsVerifyCodeWithOptions() {
          return { body: { code: "OK", model: { verifyResult } } };
        }
      },
      SendSmsVerifyCodeRequest: Request,
      CheckSmsVerifyCodeRequest: Request,
    },
    "@alicloud/openapi-client": { Config: Request },
    "@alicloud/tea-util": { RuntimeOptions: Request },
    "@alicloud/credentials": { __esModule: true, default: class {} },
  });
  return { sms: load("lib/auth/sms.ts"), ticket: load("lib/auth/sms-ticket.server.ts"), calls: admin.calls };
}

test("ticket verifies only for the same account before expiry", () => {
  const { ticket } = loadSms();
  const now = 1_700_000_000_000;
  const issued = ticket.issueSmsTicket(EMAIL, now);
  assert.equal(ticket.verifySmsTicket(issued, EMAIL, now + 60_000), true);
  assert.equal(ticket.verifySmsTicket(issued, `13900139000@phone.sanlinlaojie.local`, now), false);
  assert.equal(ticket.verifySmsTicket(issued, EMAIL, now + 10 * 60 * 1000), false);
});

test("forged, tampered and malformed tickets are rejected", () => {
  const { ticket } = loadSms();
  const issued = ticket.issueSmsTicket("13900139000@phone.sanlinlaojie.local");
  const [, signature] = issued.split(".");
  const forgedPayload = Buffer.from(`${EMAIL}|${Date.now() + 60_000}`).toString("base64url");
  assert.equal(ticket.verifySmsTicket(`${forgedPayload}.${signature}`, EMAIL), false);
  for (const bad of [undefined, null, 42, "", "abc", "a.b", `${issued}.x`]) {
    assert.equal(ticket.verifySmsTicket(bad, EMAIL), false);
  }
});

test("ticket signed with another key is rejected", () => {
  const { ticket } = loadSms();
  process.env.SUPABASE_SERVICE_ROLE_KEY = "other-key";
  const foreign = ticket.issueSmsTicket(EMAIL);
  process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role-key";
  assert.equal(ticket.verifySmsTicket(foreign, EMAIL), false);
});

test("CheckSmsVerifyCode issues a ticket only when the code passes", async () => {
  const passed = loadSms();
  const ok = await passed.sms.CheckSmsVerifyCode(PHONE, "123456");
  assert.equal(ok.success, true);
  assert.equal(passed.ticket.verifySmsTicket(ok.ticket, EMAIL), true);

  const failed = loadSms({ verifyResult: "UNKNOWN" });
  const bad = await failed.sms.CheckSmsVerifyCode(PHONE, "000000");
  assert.equal(bad.success, false);
  assert.equal(bad.ticket, undefined);
});

test("resetPasswordByPhone refuses without a valid ticket for that phone", async () => {
  const { sms, ticket, calls } = loadSms({ users: [{ id: "victim", email: EMAIL }] });
  const otherPhoneTicket = ticket.issueSmsTicket("13900139000@phone.sanlinlaojie.local");
  for (const t of [undefined, "", "forged.ticket", otherPhoneTicket]) {
    const result = await sms.resetPasswordByPhone({ phone: PHONE, newPassword: "hacked123", ticket: t });
    assert.equal(result.success, false);
    assert.equal(result.code, "code_expired");
  }
  assert.equal(calls.listUsers.length, 0);
  assert.equal(calls.updateUserById.length, 0);
});

test("resetPasswordByPhone finds users beyond the first page", async () => {
  const users = Array.from({ length: 1500 }, (_, i) => ({ id: `u${i}`, email: `${i}@example.com` }));
  users[1234] = { id: "target", email: EMAIL };
  const { sms, ticket, calls } = loadSms({ users });
  const result = await sms.resetPasswordByPhone({
    phone: PHONE,
    newPassword: "new-password",
    ticket: ticket.issueSmsTicket(EMAIL),
  });
  assert.deepEqual(result, { success: true });
  assert.deepEqual(calls.listUsers, [{ page: 1, perPage: 1000 }, { page: 2, perPage: 1000 }]);
  assert.deepEqual(calls.updateUserById, [{ id: "target", attrs: { password: "new-password" } }]);
});

test("resetPasswordByPhone reports unknown phone after scanning every page", async () => {
  const users = Array.from({ length: 1000 }, (_, i) => ({ id: `u${i}`, email: `${i}@example.com` }));
  const { sms, ticket, calls } = loadSms({ users });
  const result = await sms.resetPasswordByPhone({
    phone: PHONE,
    newPassword: "new-password",
    ticket: ticket.issueSmsTicket(EMAIL),
  });
  assert.equal(result.code, "user_not_found");
  assert.equal(calls.listUsers.length, 2);
  assert.equal(calls.updateUserById.length, 0);
});

test("createUserByPhone requires a valid ticket for that phone", async () => {
  const { sms, ticket, calls } = loadSms();
  const rejected = await sms.createUserByPhone({ phone: PHONE, password: "password1", ticket: "" });
  assert.equal(rejected.userId, null);
  assert.equal(rejected.code, "code_expired");
  assert.equal(calls.createUser.length, 0);

  const created = await sms.createUserByPhone({
    phone: PHONE,
    password: "password1",
    ticket: ticket.issueSmsTicket(EMAIL),
  });
  assert.equal(created.userId, "new-user");
  assert.equal(calls.createUser.length, 1);
  assert.equal(calls.createUser[0].email, EMAIL);
});
