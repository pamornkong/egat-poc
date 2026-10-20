import { NextResponse } from "next/server";
import { ApiError, apiFailure, authorizedTestUser, factorId, oktaManagementFetch, oktaJson, passCode, readJsonBody, safeTransaction } from "../../../../../../lib/okta";
import { db, ensureSchema } from "../../../../../../lib/database";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const { id } = await authorizedTestUser(request);
    const body = await readJsonBody(request);
    if (body.method !== "push" && body.method !== "totp") throw new ApiError(400, "เลือก method เป็น push หรือ totp");
    // The browser chooses a method, never the destination or an upstream URL.
    if ("factorId" in body || "userId" in body) throw new ApiError(400, "ปลายทางต้องมาจาก Primary ที่เซิร์ฟเวอร์บันทึกไว้เท่านั้น");
    const payload = body.method === "push" ? { useNumberMatchingChallenge: true } : passCode(body);
    await ensureSchema();
    const { rows } = await db.query<{ factor_id: string; totp_factor_id: string | null }>(
      "SELECT factor_id,totp_factor_id FROM poc_mfa_preferences WHERE user_id=$1", [id]
    );
    const selected = body.method === "push" ? rows[0]?.factor_id : rows[0]?.totp_factor_id;
    if (!selected) throw new ApiError(409, body.method === "push" ? "เลือกและบันทึก Primary ก่อนส่ง Push" : "จับคู่และบันทึก TOTP บนอุปกรณ์ Primary ก่อนทดสอบ");
    const path = `/api/v1/users/${id}/factors/${factorId(selected)}`;
    const existing = await oktaJson(path);
    const expected = body.method === "push" ? "push" : "token:software:totp";
    if (existing.status !== "ACTIVE" || existing.provider !== "OKTA" || existing.factorType !== expected) throw new ApiError(409, "Primary factor นี้ไม่พร้อมใช้งาน กรุณารีเฟรชและเลือกอุปกรณ์ใหม่");
    const response = await oktaManagementFetch(path + "/verify", { method: "POST", body: JSON.stringify(payload) });
    const result = await response.json();
    // Passcodes and SSWS headers must never appear in demo traces or downloads.
    return NextResponse.json({
      method: body.method, factorId: selected, tor: body.method === "push" ? "3.5 / 12.1" : "3.6 / 12.2",
      request: { method: "POST", path: path + "/verify", body: body.method === "push" ? payload : { passCode: "[REDACTED]" } },
      upstreamStatus: response.status, verifiedAt: new Date().toISOString(),
      result: response.ok ? safeTransaction(result, selected, id) : undefined,
      error: response.ok ? undefined : response.status === 429 ? "ส่งคำขอบ่อยเกินไป รอสักครู่ก่อนลองใหม่" : body.method === "totp" ? "Okta ไม่รับรหัส TOTP นี้ ตรวจรหัสล่าสุดและเวลาในมือถือ แล้วลองใหม่" : "Okta ไม่รับคำขอ Push ตรวจสถานะอุปกรณ์และ policy"
    }, { status: response.ok ? 200 : response.status >= 500 ? 502 : response.status, headers: { "Cache-Control": "no-store" } });
  } catch (error) { return apiFailure(error); }
}
