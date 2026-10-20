import Link from "next/link";
import type { getAccountProfile } from "../../lib/account-profile";

type AccountProfile = ReturnType<typeof getAccountProfile>;

export default function AccountMenu({ profile, protocol }: { profile: AccountProfile; protocol: string }) {
  const displayName = profile.name ?? profile.account ?? "บัญชีผู้ใช้";
  const initial = Array.from(displayName.trim())[0]?.toUpperCase() ?? "?";

  return <details className="account-menu">
    <summary className="account-box" aria-label="เปิดข้อมูลบัญชีผู้ใช้">
      <span className="account-avatar" aria-hidden="true">{initial}</span>
      <span className="account-copy"><small>Account</small><strong>{displayName}</strong></span>
      <span className="account-menu-arrow" aria-hidden="true">⌄</span>
    </summary>
    <div className="account-popover">
      <div className="account-popover-heading">
        <span className="dashboard-card-label">MY ACCOUNT</span>
        <h2>{displayName}</h2>
        <span className="account-protocol">{protocol}</span>
      </div>
      <dl className="account-menu-fields">
        <div><dt>บัญชีผู้ใช้</dt><dd>{profile.account ?? "ยังไม่ได้รับข้อมูล"}</dd></div>
        <div><dt>อีเมล</dt><dd>{profile.email ?? "ยังไม่ได้รับข้อมูล"}</dd></div>
        <div><dt>รหัสพนักงาน</dt><dd>{profile.employee_code ?? "ยังไม่ได้รับข้อมูล"}</dd></div>
        <div><dt>แผนก</dt><dd>{profile.department ?? "ยังไม่ได้รับข้อมูล"}</dd></div>
      </dl>
      <nav className="account-menu-actions" aria-label="จัดการบัญชี">
        <Link href="/success#account">ดูข้อมูลบัญชี <span aria-hidden="true">→</span></Link>
        <a href="/api/logout">ออกจากระบบ</a>
      </nav>
    </div>
  </details>;
}
