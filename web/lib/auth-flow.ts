import "server-only";
import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import type { AuthErrorCode, AuthProtocol } from "./auth-errors";

export function clearOidcCookies(response: NextResponse) {
  for (const name of ["oidc_state", "oidc_nonce", "oidc_verifier"]) {
    response.cookies.delete(name);
  }
  return response;
}

export function authFailure(
  request: Request,
  protocol: AuthProtocol,
  code: AuthErrorCode,
  error?: unknown,
) {
  if (protocol !== "logout" && error instanceof Error && error.message.startsWith("Missing environment variable:")) {
    code = "configuration_error";
  }
  const reference = randomUUID();
  // Keep tokens, assertions, provider descriptions and credentials out of logs and URLs.
  console.error("[auth]", { reference, protocol, code, errorType: error instanceof Error ? error.name : undefined });
  const url = new URL("/auth/error", request.url);
  url.searchParams.set("code", code);
  url.searchParams.set("protocol", protocol);
  url.searchParams.set("ref", reference);
  const response = NextResponse.redirect(url, 303);
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  return clearOidcCookies(response);
}
