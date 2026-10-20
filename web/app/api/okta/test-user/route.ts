import { NextResponse } from "next/server";
import { apiFailure, authorizedTestUser } from "../../../../lib/okta";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    const { user } = await authorizedTestUser();
    return NextResponse.json({ id: user.id, status: user.status, login: user.profile?.login, email: user.profile?.email }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return apiFailure(error); }
}
