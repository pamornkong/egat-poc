import { NextRequest, NextResponse } from "next/server";
import { config } from "../../../../lib/config";
import { getProvider, verifyIdToken } from "../../../../lib/oidc";
import { setSession } from "../../../../lib/session";
import { recordAuthentication } from "../../../../lib/evidence";
import { authFailure, clearOidcCookies } from "../../../../lib/auth-flow";
import { providerErrorCode, type AuthErrorCode } from "../../../../lib/auth-errors";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const providerError = url.searchParams.get("error");
  if (!code && !providerError) return authFailure(request, "oidc", "invalid_callback");
  const expectedState = request.cookies.get("oidc_state")?.value;
  if (!state || !expectedState || state !== expectedState) return authFailure(request, "oidc", "session_expired");
  if (providerError) return authFailure(request, "oidc", providerErrorCode(providerError));
  if (!code) return authFailure(request, "oidc", "invalid_callback");
  const verifier = request.cookies.get("oidc_verifier")?.value;
  const nonce = request.cookies.get("oidc_nonce")?.value;
  if (!verifier || !nonce) return authFailure(request, "oidc", "session_expired");
  let failureCode: AuthErrorCode = "provider_unavailable";
  try {
    const provider = await getProvider();
    const body = new URLSearchParams({
      grant_type: "authorization_code",
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uri: config.webBaseUrl + "/api/oidc/callback",
      code,
      code_verifier: verifier
    });
    const tokenResponse = await fetch(provider.token_endpoint, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body,
      cache: "no-store",
      signal: AbortSignal.timeout(15000)
    });
    if (!tokenResponse.ok) {
      const failure = await tokenResponse.json().catch(() => null) as { error?: string } | null;
      const code: AuthErrorCode = tokenResponse.status >= 500 || tokenResponse.status === 429 ? "provider_unavailable"
        : failure?.error === "invalid_client" || failure?.error === "unauthorized_client" ? "configuration_error" : "token_exchange_failed";
      return authFailure(request, "oidc", code);
    }
    failureCode = "invalid_response";
    const tokens = await tokenResponse.json() as { id_token?: string; access_token?: string };
    if (typeof tokens.id_token !== "string" || !tokens.id_token) return authFailure(request, "oidc", "invalid_response");
    const claims = await verifyIdToken(tokens.id_token, provider, nonce);
    failureCode = "unexpected";
    const evidenceId = await recordAuthentication("oidc", claims, tokens.id_token);
    await setSession({ ...claims, evidenceId, access_token: tokens.access_token, id_token: tokens.id_token });
    return clearOidcCookies(NextResponse.redirect(new URL("/success", request.url), 303));
  } catch (error) {
    return authFailure(request, "oidc", failureCode, error);
  }
}
