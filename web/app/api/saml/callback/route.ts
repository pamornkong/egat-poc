import { NextRequest, NextResponse } from "next/server";
import { parseSamlResponse } from "../../../../lib/saml";
import { setSession } from "../../../../lib/session";
import { authFailure } from "../../../../lib/auth-flow";
import { getAccountProfile } from "../../../../lib/account-profile";
import { recordAuthentication } from "../../../../lib/evidence";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return authFailure(request, "saml", "invalid_callback");
  }
  const value = form.get("SAMLResponse");
  if (typeof value !== "string" || !value.trim()) return authFailure(request, "saml", "invalid_callback");
  try {
    const result = await parseSamlResponse({ SAMLResponse: value, RelayState: String(form.get("RelayState") ?? "") });
    const samlSession = { protocol: "saml", nameId: result.extract.nameID, attributes: result.extract.attributes };
    const evidenceId = await recordAuthentication("saml", samlSession, value);
    await setSession({ ...samlSession, ...getAccountProfile(samlSession), evidenceId });
    return NextResponse.redirect(new URL("/success", request.url), 303);
  } catch (error) {
    return authFailure(request, "saml", "saml_failed", error);
  }
}

export async function GET(request: NextRequest) {
  return authFailure(request, "saml", "invalid_callback");
}
