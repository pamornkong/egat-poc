import fs from "node:fs";

const envPath = new URL("../.env.local", import.meta.url);
if (!fs.existsSync(envPath)) {
  console.error("Missing .env.local");
  process.exit(1);
}
for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
  const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (match) process.env[match[1]] ??= match[2];
}
const required = [
  "OKTA_ISSUER",
  "OKTA_CLIENT_ID",
  "OKTA_CLIENT_SECRET",
  "OKTA_MOBILE_CLIENT_ID",
  "SAML_IDP_METADATA_URL",
  "OKTA_API_TOKEN",
  "SESSION_SECRET",
  "OKTA_TEST_USER_ID",
  "DATABASE_URL"
];
const missing = required.filter((key) => !process.env[key]);
if (missing.length) {
  console.error("Missing: " + missing.join(", "));
  process.exit(1);
}
console.log("Okta configuration is present.");
