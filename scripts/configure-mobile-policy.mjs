import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
const env = Object.fromEntries((await readFile(resolve(import.meta.dirname, "../.env.local"), "utf8")).split(/\r?\n/).flatMap(line => { const m = line.match(/^([A-Z0-9_]+)=(.*)$/); return m ? [[m[1], m[2]]] : []; }));
const base = new URL(env.OKTA_ISSUER).origin;
const appId = env.OKTA_MOBILE_CLIENT_ID;
const name = "EGAT-POC Mobile - Password Push or FastPass UV";
const constraints = [
  { knowledge: { required: true, authenticationMethods: [{ key: "okta_password", method: "password" }] }, possession: { required: true, authenticationMethods: [{ key: "okta_verify", method: "push" }] } },
  { possession: { required: true, authenticationMethods: [{ key: "okta_verify", method: "signed_nonce" }], userVerification: "REQUIRED", phishingResistant: "REQUIRED" } }
];
async function api(path, init = {}) {
  const response = await fetch(base + path, { ...init, headers: { Authorization: "SSWS " + env.OKTA_API_TOKEN, "Content-Type": "application/json" }, signal: AbortSignal.timeout(15000) });
  const text = await response.text(); const data = text ? JSON.parse(text) : null;
  if (!response.ok) throw new Error(`Okta ${response.status}: ${data?.errorSummary ?? "failed"} ${JSON.stringify(data?.errorCauses ?? [])}`);
  return data;
}
if (!process.argv.includes("--apply")) { console.log(JSON.stringify({ mode: "dry-run", appId, name, constraints, note: "Mobile only. No change to Web/SAML, global session or authenticator enrollment policies." }, null, 2)); process.exit(0); }
const policies = await api("/api/v1/policies?type=ACCESS_POLICY");
let policy = policies.find(item => item.name === name);
if (!policy) policy = await api("/api/v1/policies", { method: "POST", body: JSON.stringify({ type: "ACCESS_POLICY", name, status: "ACTIVE", description: "Mobile POC: password + Okta Verify Push OR phishing-resistant FastPass with user verification. Does not treat local app unlock as Okta authentication." }) });
const rules = await api(`/api/v1/policies/${policy.id}/rules`);
const ruleName = "POC testers - Push or verified FastPass";
let rule = rules.find(item => item.name === ruleName);
const body = { type: "ACCESS_POLICY", name: ruleName, status: "ACTIVE", priority: 1, conditions: { people: { groups: { include: ["00g18w4tipjPafBFP698"] } } }, actions: { appSignOn: { access: "ALLOW", verificationMethod: { type: "ASSURANCE", factorMode: "2FA", reauthenticateIn: "PT1H", constraints } } } };
rule = await api(`/api/v1/policies/${policy.id}/rules${rule ? "/" + rule.id : ""}`, { method: rule ? "PUT" : "POST", body: JSON.stringify(body) });
// Assign only after rule validation succeeds, to avoid weakening the existing mobile policy on partial failure.
await api(`/api/v1/apps/${appId}/policies/${policy.id}`, { method: "PUT" });
const app = await api(`/api/v1/apps/${appId}`);
const result = await api(`/api/v1/policies/${policy.id}/rules/${rule.id}`);
console.log(JSON.stringify({ applied: true, policyId: policy.id, ruleId: result.id, appId, accessPolicy: app._links?.accessPolicy?.href, verificationMethod: result.actions?.appSignOn?.verificationMethod, pending: "Real FastPass/PIN/biometric verification and System Log evidence on a registered device" }, null, 2));
