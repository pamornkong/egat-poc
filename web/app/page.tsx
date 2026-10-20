import Link from "next/link";
import { getSession } from "../lib/session";
import { getAccountProfile } from "../lib/account-profile";
import AccountMenu from "./components/account-menu";

export default async function Home() {
  const session = await getSession();
  const profile = session ? getAccountProfile(session) : null;
  return <main>
    <header className="topbar"><div className="brand"><span className="brand-mark"><i></i><i></i><i></i><i></i></span>EGAT-POC</div>{profile ? <AccountMenu profile={profile} protocol={session?.protocol === "saml" ? "SAML 2.0" : "OpenID Connect"} /> : <span className="status">Okta connected</span>}</header>
    <section className="hero hero-layout">
      <div className="hero-copy"><span className="eyebrow">EGAT · Identity Experience</span><h1>One secure door for every identity.</h1><p>พื้นที่ทดสอบการเชื่อมต่อ Web OIDC, SAML SSO, Okta MFA API และ Mobile OIDC + PKCE ในโปรเจกต์เดียว</p><div className="pill-row"><span>OIDC + PKCE</span><span>SAML 2.0</span><span>MFA ready</span></div></div>
      <div className="hero-art" aria-hidden="true"><span className="art-orbit orbit-one"></span><span className="art-orbit orbit-two"></span><span className="art-clover"><i></i><i></i><i></i><i></i></span><span className="art-dot dot-one"></span><span className="art-dot dot-two"></span></div>
      <div className="actions hero-actions">
        <a href="/api/oidc/login">เข้าสู่ระบบด้วย OIDC</a>
        <a className="secondary" href="/api/saml/login">เข้าสู่ระบบด้วย SAML</a>
        <Link className="secondary" href="/mobile">Mobile Guide</Link>
      </div>
    </section>
    <div className="metric-row"><div><strong>03</strong><span>authentication flows</span></div><div><strong>02</strong><span>web protocols</span></div><div><strong>01</strong><span>secure workspace</span></div></div>
    <div className="grid">
      <section className="card feature-card"><div className="icon">◎</div><span className="card-label">WEB · 01</span><h2>OIDC + API</h2><p>Authorization Code + PKCE, ID token verification และ Okta MFA API</p><Link href="/api-test/primary">เดโม Push / TOTP ไป Primary →</Link><p><Link href="/api-test">MFA Lab / เพิ่มอุปกรณ์ →</Link></p></section>
      <section className="card feature-card"><div className="icon">◇</div><span className="card-label">WEB · 02</span><h2>SAML SSO</h2><p>SP-initiated SSO, ACS callback และ Custom Attribute</p><a href="/api/saml/login">เริ่ม SAML Login →</a></section>
      <section className="card feature-card session-card"><div className="icon">✓</div><span className="card-label">STATUS · LIVE</span><h2>Session</h2><p>{session ? "เข้าสู่ระบบแล้ว: " + (profile?.account ?? profile?.email ?? "user") : "ยังไม่ได้เข้าสู่ระบบ"}</p>{session ? <a href="/api/logout">ออกจากระบบ →</a> : <span className="status">รอการเข้าสู่ระบบ</span>}</section>
    </div>
  </main>;
}
