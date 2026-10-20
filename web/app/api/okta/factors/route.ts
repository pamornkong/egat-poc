import { NextResponse } from "next/server";
import { apiFailure, authorizedTestUser, oktaJson } from "../../../../lib/okta";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    const { id } = await authorizedTestUser();
    return NextResponse.json(await oktaJson(`/api/v1/users/${id}/factors/catalog`), { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return apiFailure(error); }
}
