import { NextResponse } from "next/server";
import { clearSession, getSession } from "../../../lib/session";
import { config } from "../../../lib/config";
import { authFailure, clearOidcCookies } from "../../../lib/auth-flow";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const session = await getSession();
    clearSession();
    if (typeof session?.id_token !== "string") {
      const orgLogout = new URL(config.issuer.split("/oauth2/")[0] + "/login/signout");
      orgLogout.searchParams.set("fromURI", config.webBaseUrl);
      return clearOidcCookies(NextResponse.redirect(orgLogout, 303));
    }
    const url = new URL(config.issuer + "/v1/logout");
    url.searchParams.set("id_token_hint", session.id_token);
    url.searchParams.set("post_logout_redirect_uri", config.webBaseUrl);
    return clearOidcCookies(NextResponse.redirect(url, 303));
  } catch (error) {
    clearSession();
    return authFailure(request, "logout", "logout_failed", error);
  }
}
