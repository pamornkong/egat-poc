import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { resolve, join } from "node:path";
import vm from "node:vm";

const root = resolve(import.meta.dirname, "..");
let ts;
for (const folder of ["web", "mobile"]) { try { ts = createRequire(join(root, folder, "package.json"))("typescript"); break; } catch {} }
if (!ts) throw new Error("Install web/mobile TypeScript dependencies first");
const userId = "testUserOwner001";
const secondUserId = "testUserSecond001";
const pushId = "testPushPrimary001";
const totpId = "testTotpPrimary001";
const secret = "UNIT_TEST_SSWS_NOT_A_REAL_TOKEN";
let session, owner, preference, verificationStatus, verificationBody, stale, posted;
const NextResponse = { json: (body, init) => Response.json(body, init) };
const mocks = {
  "server-only": {}, "next/server": { NextResponse },
  "./config": { config: { issuer: "https://okta.test.invalid/oauth2/default", apiToken: secret, mfaConsoleUserIds: `${userId},${secondUserId}`, webBaseUrl: "http://localhost:3000" } },
  "./session": { getSession: async () => session },
  "../../../../../../lib/database": { ensureSchema: async () => undefined, db: { query: async (query, values) => {
    assert.ok(query.startsWith("SELECT factor_id,totp_factor_id")); assert.deepEqual(Array.from(values), [owner]);
    return { rows: preference ? [preference] : [] };
  } } }
};
function load(file) {
  const compiled = ts.transpileModule(readFileSync(join(root, "web", file), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const module = { exports: {} };
  const require = key => { if (key in mocks) return mocks[key]; throw new Error("Unexpected unit-test import: " + key); };
  const fetch = async (url, init = {}) => {
    assert.ok(String(url).startsWith("https://okta.test.invalid/api/v1/users/"));
    assert.equal(init.headers.Authorization, "SSWS " + secret);
    const path = new URL(url).pathname;
    if (init.method === "POST") {
      posted.push({ path, payload: JSON.parse(init.body) });
      return Response.json(verificationBody, { status: verificationStatus });
    }
    const users = { [userId]: "owner@example.invalid", [secondUserId]: "second@example.invalid" };
    for (const [id, login] of Object.entries(users)) {
      if (path === `/api/v1/users/${id}` || path === `/api/v1/users/${encodeURIComponent(login)}`) return Response.json({ id, profile: { login } });
    }
    if (path === `/api/v1/users/${encodeURIComponent("outsider@example.invalid")}`) return Response.json({ id: "outsiderUser001", profile: { login: "outsider@example.invalid" } });
    const id = path.split("/").at(-1);
    return Response.json({ id, provider: "OKTA", factorType: id === pushId ? "push" : "token:software:totp", status: stale ? "INACTIVE" : "ACTIVE" });
  };
  const evaluate = vm.runInNewContext("(function(require,module,exports){" + compiled + "\n})", { Request, Response, URL, AbortSignal, fetch });
  evaluate(require, module, module.exports); return module.exports;
}
mocks["./account-profile"] = load("lib/account-profile.ts");
const helper = load("lib/okta.ts"); mocks["../../../../../../lib/okta"] = helper;
const route = load("app/api/okta/test-user/primary/verify/route.ts");
function reset() {
  session = { sub: userId }; owner = userId; preference = { factor_id: pushId, totp_factor_id: totpId }; stale = false; posted = [];
  verificationStatus = 201; verificationBody = { factorResult: "WAITING", _embedded: { challenge: { correctAnswer: 42 } }, _links: { poll: { href: `https://okta.test.invalid/api/v1/users/${userId}/factors/${pushId}/transactions/testTransaction001` } } };
}
async function run(body, origin = "http://localhost:3000") {
  return route.POST(new Request("http://localhost:3000/api/okta/test-user/primary/verify", { method: "POST", headers: { Origin: origin, "Content-Type": "application/json" }, body: JSON.stringify(body) }));
}
const cases = [];
reset(); let response = await run({ method: "push" }); let data = await response.json();
assert.equal(response.status, 200); assert.equal(data.factorId, pushId); assert.equal(data.upstreamStatus, 201);
assert.equal(data.result.correctAnswer, 42); assert.equal(data.result.transactionId, "testTransaction001");
assert.equal(posted[0].path, `/api/v1/users/${userId}/factors/${pushId}/verify`); assert.equal(posted[0].payload.useNumberMatchingChallenge, true);
assert.equal(JSON.stringify(data).includes(secret), false); cases.push("Push targets database Primary, enables Number Matching and retains real upstream 201 + poll transaction");
reset(); verificationStatus = 200; verificationBody = { factorResult: "SUCCESS" }; response = await run({ method: "totp", passCode: "123456" }); data = await response.json();
assert.equal(response.status, 200); assert.equal(data.factorId, totpId); assert.equal(posted[0].payload.passCode, "123456");
assert.equal(data.request.body.passCode, "[REDACTED]"); assert.equal(JSON.stringify(data).includes("123456"), false); cases.push("TOTP targets paired Primary factor; passes OTP upstream and redacts it from response");
reset(); session = { sub: secondUserId }; owner = secondUserId; response = await run({ method: "push" });
assert.equal(response.status, 200); assert.equal(posted[0].path, `/api/v1/users/${secondUserId}/factors/${pushId}/verify`); cases.push("Second allowlisted OIDC user reaches only their own Okta user");
reset(); session = { protocol: "saml", nameId: "second@example.invalid" }; owner = secondUserId; response = await run({ method: "push" });
assert.equal(response.status, 200); assert.equal(posted[0].path, `/api/v1/users/${secondUserId}/factors/${pushId}/verify`); cases.push("SAML session resolves to its own allowlisted Okta user");
for (const [name, change, body, status] of [
  ["No Primary", () => { preference = null; }, { method: "push" }, 409],
  ["No paired TOTP", () => { preference.totp_factor_id = null; }, { method: "totp", passCode: "123456" }, 409],
  ["Stale Primary", () => { stale = true; }, { method: "push" }, 409],
  ["Mismatched factor type", () => { preference.factor_id = totpId; }, { method: "push" }, 409],
  ["Caller destination override", () => {}, { method: "push", factorId: "otherFactor" }, 400],
  ["Invalid OTP", () => {}, { method: "totp", passCode: "wrong" }, 400],
  ["Unsupported method", () => {}, { method: "sms" }, 400],
  ["Wrong owner", () => { session = { sub: "anotherUser001" }; }, { method: "push" }, 403],
  ["SAML user outside allowlist", () => { session = { protocol: "saml", nameId: "outsider@example.invalid" }; }, { method: "push" }, 403],
  ["Unauthenticated", () => { session = null; }, { method: "push" }, 401]
]) { reset(); change(); response = await run(body); assert.equal(response.status, status, name); assert.equal(posted.length, 0, name); cases.push(name + " rejected before verification POST"); }
reset(); response = await run({ method: "push" }, "https://other.test.invalid"); assert.equal(response.status, 403); assert.equal(posted.length, 0); cases.push("Cross-origin request rejected before verification POST");
reset(); verificationStatus = 403; verificationBody = { errorSummary: "Do not echo this 123456 " + secret }; response = await run({ method: "totp", passCode: "123456" }); data = await response.json();
assert.equal(response.status, 403); assert.equal(JSON.stringify(data).includes("123456"), false); assert.equal(JSON.stringify(data).includes(secret), false); assert.equal(data.result, undefined); cases.push("Upstream invalid OTP returns failure without raw error/token/OTP echo");
console.log(JSON.stringify({ kind: "UNIT_TEST_MOCK_OKTA_AND_DATABASE_NO_NETWORK", ok: cases.length, cases }, null, 2));
