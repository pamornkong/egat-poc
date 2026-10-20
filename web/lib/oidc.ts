import { createHash, randomBytes } from "node:crypto";
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";
import { config } from "./config";

type Provider = {
  authorization_endpoint: string;
  token_endpoint: string;
  jwks_uri: string;
  issuer: string;
};

let providerPromise: Promise<Provider> | undefined;
export function getProvider(): Promise<Provider> {
  providerPromise ??= fetch(config.issuer + "/.well-known/openid-configuration", { cache: "no-store", signal: AbortSignal.timeout(15000) })
    .then(async (response) => {
      if (!response.ok) throw new Error("OIDC discovery failed: " + response.status);
      return await response.json() as Provider;
    }).catch((error) => {
      providerPromise = undefined;
      throw error;
    });
  return providerPromise;
}

export function randomUrlSafe(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

export function pkceChallenge(verifier: string): string {
  return createHash("sha256").update(verifier).digest("base64url");
}

export async function verifyIdToken(idToken: string, provider: Provider, nonce: string, audience = config.clientId): Promise<JWTPayload> {
  const jwks = createRemoteJWKSet(new URL(provider.jwks_uri));
  const result = await jwtVerify(idToken, jwks, { issuer: config.issuer, audience, algorithms: ["RS256"], requiredClaims: ["exp", "iat", "sub", "nonce"] });
  if (result.payload.nonce !== nonce) throw new Error("OIDC nonce mismatch");
  return result.payload;
}
