import { NextResponse } from "next/server";
import { ApiError, apiFailure, authorizedTestUser, factorId, oktaJson, readJsonBody } from "../../../../../lib/okta";
import { db, ensureSchema } from "../../../../../lib/database";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  try {
    const { id } = await authorizedTestUser(request);
    const body = await readJsonBody(request);
    const selected = typeof body.factorId === "string" ? body.factorId : "";
    const factor = await oktaJson(`/api/v1/users/${id}/factors/${factorId(selected)}`);
    if (factor.status !== "ACTIVE" || factor.provider !== "OKTA" || factor.factorType !== "push") throw new ApiError(400, "Primary ต้องเป็น Okta Verify Push ที่ ACTIVE ของบัญชีนี้");
    let totpId: string | null = null;
    if (body.totpFactorId) {
      totpId = typeof body.totpFactorId === "string" ? body.totpFactorId : "";
      const totp = await oktaJson(`/api/v1/users/${id}/factors/${factorId(totpId)}`);
      if (totp.status !== "ACTIVE" || totp.provider !== "OKTA" || totp.factorType !== "token:software:totp") throw new ApiError(400, "เลือก TOTP factor ที่ ACTIVE ของบัญชีเดียวกัน");
    }
    await ensureSchema();
    await db.query("INSERT INTO poc_mfa_preferences(user_id,factor_id,totp_factor_id) VALUES($1,$2,$3) ON CONFLICT(user_id) DO UPDATE SET factor_id=$2,totp_factor_id=$3,updated_at=now()", [id, selected, totpId]);
    return NextResponse.json({ primaryFactorId: selected, primaryTotpFactorId: totpId });
  } catch (error) { return apiFailure(error); }
}
