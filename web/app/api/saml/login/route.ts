import { NextResponse } from "next/server";
import { getSamlLoginUrl } from "../../../../lib/saml";
import { authFailure } from "../../../../lib/auth-flow";

export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try {
    return NextResponse.redirect(await getSamlLoginUrl());
  } catch (error) {
    return authFailure(request, "saml", "provider_unavailable", error);
  }
}
