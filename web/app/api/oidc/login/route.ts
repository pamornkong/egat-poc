import { NextResponse } from "next/server";
import { config } from "../../../../lib/config";
import { getProvider, pkceChallenge, randomUrlSafe } from "../../../../lib/oidc";
import { authFailure } from "../../../../lib/auth-flow";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const provider = await getProvider();
    const state = randomUrlSafe();
    const nonce = randomUrlSafe();
    const verifier = randomUrlSafe(48);
    const url = new URL(provider.authorization_endpoint);
    url.searchParams.set("client_id", config.clientId);
    url.searchParams.set("redirect_uri", config.webBaseUrl + "/api/oidc/callback");
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", "openid profile email");
    url.searchParams.set("state", state);
    url.searchParams.set("nonce", nonce);
    url.searchParams.set("code_challenge", pkceChallenge(verifier));
    url.searchParams.set("code_challenge_method", "S256");
    const response = NextResponse.redirect(url);
    for (const item of [["oidc_state", state], ["oidc_nonce", nonce], ["oidc_verifier", verifier]]) {
      response.cookies.set(item[0], item[1], { httpOnly: true, sameSite: "lax", secure: config.webBaseUrl.startsWith("https://"), path: "/", maxAge: 600 });
    }
    return response;
  } catch (error) {
    return authFailure(request, "oidc", "provider_unavailable", error);
  }
}
