import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
const root = resolve(import.meta.dirname, "..");
const env = Object.fromEntries((await readFile(resolve(root, ".env.local"), "utf8")).split(/\r?\n/).flatMap(line => { const m = line.match(/^([A-Z0-9_]+)=(.*)$/); return m ? [[m[1], m[2]]] : []; }));
const base = new URL(env.OKTA_ISSUER).origin;
const authorization = "SSWS " + env.OKTA_API_TOKEN;
const brandId = "bnd18w4eg35RS7CIn698";
const themeId = "the18w4eg36tdKOfQ698";
const path = `/api/v1/brands/${brandId}/themes/${themeId}`;
async function api(path, init = {}) {
  const response = await fetch(base + path, { ...init, headers: { Authorization: authorization, ...(init.headers ?? {}) }, signal: AbortSignal.timeout(20000) });
  const data = await response.json();
  if (!response.ok) throw new Error(`Branding API ${response.status}: ${data.errorSummary ?? "failed"}`);
  return data;
}
const before = await api(path);
const changes = {
  primaryColorHex: "#187344", primaryColorContrastHex: "#ffffff",
  secondaryColorHex: "#eff8f1", secondaryColorContrastHex: "#000000",
  signInPageTouchPointVariant: "BACKGROUND_IMAGE",
  endUserDashboardTouchPointVariant: before.endUserDashboardTouchPointVariant,
  errorPageTouchPointVariant: before.errorPageTouchPointVariant,
  emailTemplateTouchPointVariant: before.emailTemplateTouchPointVariant,
  loadingPageTouchPointVariant: before.loadingPageTouchPointVariant
};
if (!process.argv.includes("--apply")) { console.log(JSON.stringify({ mode: "dry-run", brandId, themeId, changes }, null, 2)); process.exit(0); }
// Basic assets/colors only. Does not replace sign-in HTML, recovery links, domains or authentication policies.
for (const [endpoint, name] of [["logo", "logo.png"], ["background-image", "background.png"]]) {
  const bytes = await readFile(resolve(root, "docs/branding/assets", name));
  const form = new FormData(); form.set("file", new Blob([bytes], { type: "image/png" }), name);
  await api(path + "/" + endpoint, { method: "POST", body: form });
}
await api(path, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(changes) });
const after = await api(path);
console.log(JSON.stringify({ brandId, themeId, applied: true, primaryColorHex: after.primaryColorHex, signInPageTouchPointVariant: after.signInPageTouchPointVariant, logo: after.logo, backgroundImage: after.backgroundImage }, null, 2));
