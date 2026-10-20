import "server-only";
import { createHash } from "node:crypto";
import { db, ensureSchema } from "./database";
import { getAccountProfile } from "./account-profile";

// Never persist bearer tokens, complete assertions, QR secrets or passcodes.
export async function recordAuthentication(protocol: "oidc" | "saml", claims: Record<string, unknown>, proof: string) {
  await ensureSchema();
  const profile = getAccountProfile(claims);
  const account = profile.account ?? profile.email ?? profile.sub;
  if (!account) throw new Error("Verified response has no account");
  const validation = protocol === "oidc" ? "jose: signature/JWKS, issuer, audience, expiry, nonce; callback state + PKCE" : "samlify: schema, signed assertion, issuer, validity window; app: audience, destination, required expiry, replay digest";
  const result = await db.query<{ id: string }>(
    "INSERT INTO poc_auth_evidence(protocol,account,profile,proof_sha256,validation) VALUES($1,$2,$3,$4,$5) RETURNING id",
    [protocol, account, JSON.stringify(profile), createHash("sha256").update(protocol === "saml" ? Buffer.from(proof, "base64") : proof).digest("hex"), validation]
  );
  return result.rows[0].id;
}

export async function ownEvidence(claims: Record<string, unknown>) {
  await ensureSchema();
  const profile = getAccountProfile(claims);
  const account = profile.account ?? profile.email ?? profile.sub ?? "";
  return (await db.query("SELECT id,protocol,account,profile,proof_sha256,validation,authenticated_at FROM poc_auth_evidence WHERE account=$1 ORDER BY id DESC LIMIT 30", [account])).rows;
}
