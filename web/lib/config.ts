import "server-only";

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error("Missing environment variable: " + name);
  return value;
}

export const config = {
  get issuer() { return required("OKTA_ISSUER").replace(/\/$/, ""); },
  get clientId() { return required("OKTA_CLIENT_ID"); },
  get clientSecret() { return required("OKTA_CLIENT_SECRET"); },
  get mobileClientId() { return required("OKTA_MOBILE_CLIENT_ID"); },
  get samlMetadataUrl() { return required("SAML_IDP_METADATA_URL"); },
  get apiToken() { return required("OKTA_API_TOKEN"); },
  get sessionSecret() { return required("SESSION_SECRET"); },
  get webBaseUrl() { return process.env.WEB_BASE_URL ?? "http://localhost:3000"; },
  get samlEntityId() { return process.env.SAML_ENTITY_ID ?? "http://localhost:3000/saml"; },
  get samlAcsUrl() { return process.env.SAML_ACS_URL ?? "http://localhost:3000/api/saml/callback"; },
  get mfaConsoleUserIds() { return process.env.OKTA_MFA_CONSOLE_USER_IDS ?? ""; },
  get databaseUrl() { return required("DATABASE_URL"); }
};
