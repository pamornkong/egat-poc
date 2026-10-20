import Link from "next/link";
import { authErrors, type AuthErrorCode, type AuthProtocol } from "../../lib/auth-errors";

export default function ErrorScreen({ code, protocol, reference, onRetry }: {
  code: AuthErrorCode;
  protocol?: AuthProtocol;
  reference?: string;
  onRetry?: () => void;
}) {
  const error = authErrors[code];
  const retryUrl = protocol === "saml" ? "/api/saml/login" : protocol === "logout" ? "/api/logout" : "/api/oidc/login";
  const retryLabel = protocol === "logout" ? "ออกจาก Okta อีกครั้ง" : "ลองเข้าสู่ระบบอีกครั้ง";
  return <main className="error-page">
    <header className="topbar"><Link className="brand" href="/"><span className="brand-mark" aria-hidden="true"><i /><i /><i /><i /></span>EGAT-POC</Link><span className="error-header-label">ศูนย์ช่วยเหลือการเข้าใช้งาน</span></header>
    <section className="error-layout" aria-labelledby="error-title">
      <div className="error-story">
        <span className="eyebrow">LET’S GET YOU BACK</span>
        <div className="error-symbol" aria-hidden="true">{code === "not_found" ? "?" : "!"}</div>
        <h1 id="error-title">{error.title}</h1>
        <p>{error.message}</p>
        <span className="error-context">{protocol === "saml" ? "SAML SSO" : protocol === "oidc" ? "OpenID Connect" : protocol === "logout" ? "ออกจากระบบ" : "EGAT-POC"}</span>
      </div>
      <div className="error-recovery">
        <span className="eyebrow">ขั้นตอนถัดไป</span>
        <h2>กลับไปใช้งานต่อได้</h2>
        <p>{error.hint}</p>
        <div className="actions error-actions">
          {onRetry ? <button className="button" onClick={onRetry}>ลองอีกครั้ง</button> : code !== "not_found" && <a href={retryUrl}>{retryLabel} <span aria-hidden="true">→</span></a>}
          <Link className="secondary" href="/">กลับหน้าแรก</Link>
        </div>
        {protocol === "oidc" && code === "access_denied" && <a className="error-switch" href="/api/logout">ออกจาก Okta เพื่อเปลี่ยนบัญชี →</a>}
        <div className="error-reference"><span>รหัสปัญหา</span><strong>{code.toUpperCase()}</strong>{reference && <><span>รหัสอ้างอิงสำหรับผู้ดูแล</span><code>{reference}</code></>}</div>
      </div>
    </section>
    <p className="error-footer">EGAT-POC · Identity &amp; Access</p>
  </main>;
}
