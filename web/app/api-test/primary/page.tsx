import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "../../../lib/session";
import PrimaryDemo from "./primary-demo";

export const dynamic = "force-dynamic";
export default async function PrimaryDemoPage() {
  if (!await getSession()) redirect("/auth/error?code=login_required");
  return <main className="primary-demo-page">
    <header className="topbar"><Link className="brand" href="/success">EGAT-POC</Link><div className="demo-nav"><Link href="/api-test">MFA Lab</Link><Link href="/api-test/primary/source" target="_blank" rel="noopener noreferrer">ดู Source code ↗</Link></div></header>
    <section className="hero primary-demo-hero"><span className="eyebrow">TOR 3.5 + 3.6 · REST API demonstration</span><h1>Primary MFA Demo</h1><p>สองข้อ สองปุ่ม — ส่ง Push และตรวจ TOTP บนอุปกรณ์ Primary พร้อมแสดง REST request และผลตอบกลับสำหรับสาธิต</p><div className="pill-row"><span>12.1 · Push + Number Matching</span><span>12.2 · TOTP verification</span><span>Server-selected Primary</span></div></section>
    <PrimaryDemo />
  </main>;
}
