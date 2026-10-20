import Link from "next/link";
import { redirect } from "next/navigation";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { getSession } from "../../../../lib/session";

export const dynamic = "force-dynamic";
// Fixed allowlist only; no request parameter can select a file or expose .env.
const files = [
  ["Primary REST verification · อ่านปลายทางจาก PostgreSQL แล้วเรียก Okta", "app/api/okta/test-user/primary/verify/route.ts"],
  ["Push transaction polling · รอผลอนุมัติจากอุปกรณ์", "app/api/okta/test-user/factors/[factorId]/transactions/[transactionId]/route.ts"],
  ["Primary setup · ตรวจ owner/factor และบันทึกปลายทาง", "app/api/okta/test-user/primary/route.ts"],
  ["Server-side helpers · authorization, CSRF, SSWS และ response filtering", "lib/okta.ts"]
] as const;

export default async function DemoSource() {
  if (!await getSession()) redirect("/auth/error?code=login_required");
  const sources = await Promise.all(files.map(async ([label, file]) => ({ label, file, code: await readFile(path.join(process.cwd(), file), "utf8") })));
  return <main><header className="topbar"><Link className="brand" href="/api-test/primary">← กลับ Primary Demo</Link><span className="eyebrow">Source walkthrough</span></header><section className="card"><h1>Source code สำหรับสาธิตข้อ 5 / 6</h1><p>ไฟล์ที่แสดงอ่านจาก source จริงในแอป ไม่แสดงไฟล์ environment หรือค่า API Token การเลือก Primary เป็น preference ของ POC ไม่เปลี่ยนค่า default device ของ Okta Hosted Sign-In</p></section><section className="evidence-list">{sources.map((item, index) => <details className="card demo-source" key={item.file} open={index === 0}><summary>{item.label}</summary><p><code>{item.file}</code></p><pre>{item.code}</pre></details>)}</section></main>;
}
