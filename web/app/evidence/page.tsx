import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "../../lib/session";
import { ownEvidence } from "../../lib/evidence";
export const dynamic = "force-dynamic";
export default async function EvidencePage() {
  const session = await getSession();
  if (!session) redirect("/auth/error?code=login_required");
  const rows = await ownEvidence(session);
  return <main><header className="topbar"><Link className="brand" href="/success">EGAT-POC</Link><Link href="/api/evidence">ดาวน์โหลด JSON</Link></header>
    <section className="hero"><span className="eyebrow">Authentication evidence</span><h1>หลักฐานการเข้าสู่ระบบ</h1><p>ข้อมูลของบัญชีปัจจุบัน บันทึกเมื่อ callback ตรวจสอบผ่านเท่านั้น ไม่เก็บ token หรือ SAML assertion เต็ม</p></section>
    {!rows.length && <section className="card"><h2>ยังไม่มีหลักฐานในรอบนี้</h2><p>ออกจากระบบแล้ว Login ใหม่เพื่อบันทึก callback จริง ไม่ใช้ข้อมูลจำลองเป็นผลผ่าน TOR</p></section>}
    <section className="evidence-list">{rows.map(row => <article className="card" key={row.id}><span className="eyebrow">#{row.id} · {row.protocol.toUpperCase()}</span><h2>{row.account}</h2><p>{new Date(row.authenticated_at).toLocaleString("th-TH", { timeZone: "Asia/Bangkok" })} · Asia/Bangkok</p><pre>{JSON.stringify(row.profile, null, 2)}</pre><p>{row.validation}</p><details><summary>SHA-256 ของ response ที่ตรวจผ่าน</summary><code className="proof-digest">{row.proof_sha256}</code></details></article>)}</section>
    <p>ผลนี้ไม่ยืนยันการทำ MFA แบบใดโดยลำพัง ต้องเทียบกับ Okta System Log และหลักฐานอุปกรณ์ด้วย</p>
  </main>;
}
