import Link from "next/link";
import { getSession } from "../../lib/session";
import MfaConsole from "./mfa-console";
import { redirect } from "next/navigation";

export default async function ApiTest() {
  const session = await getSession();
  if (!session) redirect("/auth/error?code=login_required");
  return <main><header className="topbar"><Link className="brand" href="/success">EGAT-POC</Link><Link href="/evidence">หลักฐาน Callback →</Link></header><section className="hero"><span className="eyebrow">Server-side management API</span><h1>MFA Lab</h1><p>ทดสอบ Enrollment, Push, TOTP และ Primary device โดยไม่ส่ง Management API token ไปยังเบราว์เซอร์</p><div className="actions"><Link href="/api-test/primary">เดโมข้อ 5 / 6 · Push + TOTP ไป Primary →</Link></div></section><MfaConsole /></main>;
}
