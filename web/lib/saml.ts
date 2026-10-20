import "server-only";
import * as samlify from "samlify";
import * as validator from "@authenio/samlify-node-xmllint";
import { config } from "./config";

samlify.setSchemaValidator(validator);

let metadata: Promise<string> | undefined;
let idp: Promise<samlify.IdentityProviderInstance> | undefined;
function getIdp() {
  idp ??= (metadata ??= fetch(config.samlMetadataUrl, { cache: "no-store", signal: AbortSignal.timeout(15000) }).then(async (response) => {
    if (!response.ok) throw new Error("SAML metadata failed: " + response.status);
    return response.text();
  })).then((text) => samlify.IdentityProvider({ metadata: text })).catch((error) => {
    metadata = undefined;
    idp = undefined;
    throw error;
  });
  return idp;
}

function getSp() {
  return samlify.ServiceProvider({
    entityID: config.samlEntityId,
    wantAssertionsSigned: true,
    assertionConsumerService: [{
      Binding: "urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST",
      Location: config.samlAcsUrl
    }]
  });
}

export async function getSamlLoginUrl() {
  const result = getSp().createLoginRequest(await getIdp(), "redirect");
  return result.context;
}

export async function parseSamlResponse(body: Record<string, string>) {
  if (body.SAMLResponse.length > 700000) throw new Error("SAML response too large");
  const result = await getSp().parseLoginResponse(await getIdp(), "post", { body });
  const extracted = result.extract;
  const audiences = Array.isArray(extracted.audience) ? extracted.audience : [extracted.audience];
  if (!audiences.includes(config.samlEntityId)) throw new Error("SAML audience mismatch");
  if (extracted.response?.destination !== config.samlAcsUrl) throw new Error("SAML destination mismatch");
  if (!extracted.nameID || !extracted.conditions?.notOnOrAfter) throw new Error("SAML subject or expiry missing");
  return result;
}
