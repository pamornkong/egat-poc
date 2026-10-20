import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "../../lib/session";
import { getAccountProfile } from "../../lib/account-profile";
import AccountMenu from "../components/account-menu";

export const dynamic = "force-dynamic";

export default async function SuccessPage() {
  const session = await getSession();
  if (!session) redirect("/auth/error?code=login_required");
  const profile = getAccountProfile(session);
  const protocol = session?.protocol === "saml" ? "SAML 2.0" : "OpenID Connect";
  const identity = profile.account ?? profile.email ?? profile.sub ?? "Authenticated user";
  const displayName = profile.name ?? identity;
  const employeeCode = profile.employee_code;
  const department = profile.department;

  return <main>
    <header className="topbar"><Link className="brand" href="/"><span className="brand-mark"><i></i><i></i><i></i><i></i></span>EGAT-POC</Link><AccountMenu profile={profile} protocol={protocol} /></header>
    <section className="dashboard-head"><div><span className="eyebrow">Identity dashboard</span><h1>ยินดีต้อนรับกลับมา</h1><p>การยืนยันตัวตนเสร็จสมบูรณ์ ระบบพร้อมใช้งานแล้ว</p></div><span className="verified-badge"><i></i> Verified</span></section>
    <section className="success-panel">
      <div className="success-main"><div className="success-check">✓</div><div><span className="eyebrow">Authentication complete</span><h2>เข้าสู่ระบบสำเร็จ</h2><p>ระบบได้รับ callback จาก Identity Provider และสร้าง session ให้เรียบร้อยแล้ว</p></div></div>
      <div className="success-details"><div><span>Identity</span><strong>{identity}</strong></div><div><span>Protocol</span><strong>{protocol}</strong></div><div><span>Session</span><strong>{session ? "Active · 8 hours" : "Not found"}</strong></div></div>
    </section>
    <section className="dashboard-grid">
      <div className="dashboard-card" id="account" aria-label="ข้อมูลบัญชีผู้ใช้">
        <span className="dashboard-card-label">ACCOUNT</span>
        <h3>{displayName}</h3>
        <dl className="account-claims" aria-label="ข้อมูลโปรไฟล์จาก Okta">
          <div>
            <dt>บัญชีผู้ใช้<small>{session.protocol === "saml" ? "NameID" : "Account"}</small></dt>
            <dd className={profile.account ? undefined : "claim-missing"}>{profile.account ?? "ยังไม่ได้รับข้อมูล"}</dd>
          </div>
          <div>
            <dt>อีเมล<small>email</small></dt>
            <dd className={profile.email ? undefined : "claim-missing"}>{profile.email ?? "ยังไม่ได้รับข้อมูล"}</dd>
          </div>
          <div>
            <dt>รหัสพนักงาน<small>employee_code</small></dt>
            <dd className={employeeCode ? undefined : "claim-missing"}>{employeeCode ?? "ยังไม่ได้รับข้อมูล"}</dd>
          </div>
          <div>
            <dt>แผนก<small>department</small></dt>
            <dd className={department ? undefined : "claim-missing"}>{department ?? "ยังไม่ได้รับข้อมูล"}</dd>
          </div>
        </dl>
        {(!profile.email || !employeeCode || !department) && <p className="claim-note">หากเพิ่งปรับข้อมูลใน Okta ให้ออกจากระบบแล้วเข้าสู่ระบบใหม่เพื่อรับข้อมูลล่าสุด</p>}
        <div className="detail-line"><span>Account status</span><b className="green-text">Active</b></div>
      </div>
      <div className="dashboard-card"><span className="dashboard-card-label">AUTHENTICATION</span><h3>{protocol}</h3><p>Secure callback verified</p><div className="detail-line"><span>Identity response</span><b className="green-text">Validated</b></div><p className="claim-note">ชนิดของ MFA ต้องตรวจจาก Okta System Log ไม่สรุปจาก session อย่างเดียว</p><Link href="/evidence">ดูหลักฐาน callback →</Link></div>
      <div className="dashboard-card"><span className="dashboard-card-label">QUICK ACTIONS</span><h3>ไปต่อได้เลย</h3><p>จัดการการทดสอบของคุณ</p><div className="actions compact-actions"><Link href="/api-test/primary">เดโม Push / TOTP</Link><Link className="secondary" href="/api-test">MFA Lab</Link><Link className="secondary" href="/">หน้าหลัก</Link></div></div>
    </section>
  </main>;
}
