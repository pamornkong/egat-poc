import { NextResponse } from "next/server";
import { ApiError, apiFailure, authorizedTestUser, factorId, oktaJson, passCode, readJsonBody, safeTransaction } from "../../../../../../../lib/okta";
export const dynamic = "force-dynamic";
export async function POST(request: Request, { params }: { params: { factorId: string } }) {
  try {
    const { id } = await authorizedTestUser(request);
    const factor = factorId(params.factorId);
    const existing = await oktaJson(`/api/v1/users/${id}/factors/${factor}`);
    const body = await readJsonBody(request);
    if (existing.status !== "ACTIVE" || existing.provider !== "OKTA" || !["push", "token:software:totp"].includes(existing.factorType)) throw new ApiError(400, "เลือก Okta Verify Push หรือ TOTP ที่ ACTIVE");
    const payload = existing.factorType === "push" ? { useNumberMatchingChallenge: true } : passCode(body);
    const result = await oktaJson(`/api/v1/users/${id}/factors/${factor}/verify`, { method: "POST", body: JSON.stringify(payload) });
    return NextResponse.json(safeTransaction(result, params.factorId, id), { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return apiFailure(error); }
}

