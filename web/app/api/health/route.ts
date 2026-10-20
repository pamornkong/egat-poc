import { NextResponse } from "next/server";
import { db, ensureSchema } from "../../../lib/database";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    await ensureSchema();
    await db.query("SELECT 1");
    return NextResponse.json({ ok: true, service: "egat-poc-web", database: "ready" });
  } catch {
    return NextResponse.json({ ok: false, service: "egat-poc-web", database: "unavailable" }, { status: 503 });
  }
}
