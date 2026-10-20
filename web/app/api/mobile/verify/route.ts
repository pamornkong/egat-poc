import { NextResponse } from "next/server";
import { config } from "../../../../lib/config";
import { getProvider, verifyIdToken } from "../../../../lib/oidc";
import { getAccountProfile } from "../../../../lib/account-profile";
export const dynamic = "force-dynamic";
// Native app only: validates a supplied ID token; never creates a web session or accepts a caller-selected issuer/audience.
export async function POST(request: Request) {
  try {
    if (!request.headers.get("content-type")?.startsWith("application/json")) return NextResponse.json({ error: "JSON required" }, { status: 415 });
    const text = await request.text();
    if (text.length > 20000) return NextResponse.json({ error: "Request too large" }, { status: 413 });
    const { idToken, nonce } = JSON.parse(text);
    if (typeof idToken !== "string" || typeof nonce !== "string" || nonce.length < 16 || nonce.length > 200) return NextResponse.json({ error: "Invalid token request" }, { status: 400 });
    const claims = await verifyIdToken(idToken, await getProvider(), nonce, config.mobileClientId);
    return NextResponse.json({ profile: getAccountProfile(claims), expiresAt: claims.exp }, { headers: { "Cache-Control": "no-store" } });
  } catch { return NextResponse.json({ error: "ID token validation failed" }, { status: 401, headers: { "Cache-Control": "no-store" } }); }
}
