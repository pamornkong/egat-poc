import { NextResponse } from "next/server";
import { ApiError, apiFailure, authorizedTestUser, factorId, oktaJson, passCode, readJsonBody, safeFactor } from "../../../../../../../lib/okta";
export const dynamic = "force-dynamic";
export async function POST(request: Request, { params }: { params: { factorId: string } }) {
  try {
    const { id } = await authorizedTestUser(request);
    const factor = factorId(params.factorId);
    const existing = await oktaJson(`/api/v1/users/${id}/factors/${factor}`);
    if (existing.provider !== "OKTA" || !["push", "token:software:totp"].includes(existing.factorType)) throw new ApiError(400, "ไม่รองรับ factor นี้");
    const body = await readJsonBody(request);
    const payload = existing.factorType === "push" ? {} : passCode(body);
    return NextResponse.json(safeFactor(await oktaJson(`/api/v1/users/${id}/factors/${factor}/lifecycle/activate`, { method: "POST", body: JSON.stringify(payload) })), { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return apiFailure(error); }
}

