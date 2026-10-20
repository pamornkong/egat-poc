import { NextResponse } from "next/server";
import { ApiError, apiFailure, authorizedTestUser, oktaJson, readJsonBody, safeFactor } from "../../../../../lib/okta";
import { db, ensureSchema } from "../../../../../lib/database";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    const { id } = await authorizedTestUser();
    const factors = await oktaJson(`/api/v1/users/${id}/factors`);
    await ensureSchema();
    const preferences = await db.query("SELECT factor_id,totp_factor_id FROM poc_mfa_preferences WHERE user_id=$1", [id]);
    return NextResponse.json({ factors: factors.map(safeFactor), primaryFactorId: preferences.rows[0]?.factor_id ?? null, primaryTotpFactorId: preferences.rows[0]?.totp_factor_id ?? null }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return apiFailure(error); }
}
export async function POST(request: Request) {
  try {
    const { id } = await authorizedTestUser(request);
    const body = await readJsonBody(request);
    if (body.provider !== "OKTA" || !["push", "token:software:totp"].includes(String(body.factorType))) throw new ApiError(400, "POC รองรับ enrollment ของ Okta Verify Push / TOTP เท่านั้น");
    const result = await oktaJson(`/api/v1/users/${id}/factors`, { method: "POST", body: JSON.stringify({ factorType: body.factorType, provider: "OKTA" }) });
    return NextResponse.json(safeFactor(result), { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return apiFailure(error); }
}

