import { NextResponse } from "next/server";
import { getSession } from "../../../lib/session";
import { ownEvidence } from "../../../lib/evidence";
export const dynamic = "force-dynamic";
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  return NextResponse.json({ source: "verified_server_callbacks", scope: "current_account_only", records: await ownEvidence(session) }, {
    headers: { "Cache-Control": "no-store", "Content-Disposition": "attachment; filename=egat-poc-evidence.json" }
  });
}
