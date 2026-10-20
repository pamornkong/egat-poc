"use client";
import { useEffect, useRef, useState } from "react";

type Factor = { id: string; factorType: string; provider: string; status: string; device?: string; activation?: { qrCode?: string; expiresAt?: string } };
type Transaction = { factorResult?: string; status?: string; correctAnswer?: number; transactionId?: string };
async function api(path: string, body?: unknown) {
  const response = await fetch("/api/okta/" + path, {
    method: body === undefined ? "GET" : "POST", credentials: "same-origin", cache: "no-store",
    headers: body === undefined ? {} : { "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body)
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error ?? "ทำรายการไม่สำเร็จ");
  return data;
}

export default function MfaConsole() {
  const [factors, setFactors] = useState<Factor[]>([]);
  const [primary, setPrimary] = useState<string | null>(null);
  const [primaryTotp, setPrimaryTotp] = useState("");
  const [user, setUser] = useState<{ login: string; status: string }>();
  const [code, setCode] = useState("");
  const [activationCode, setActivationCode] = useState("");
  const [selected, setSelected] = useState("");
  const [enrollment, setEnrollment] = useState<Factor>();
  const [transaction, setTransaction] = useState<Transaction>();
  const [message, setMessage] = useState("กำลังโหลดบัญชีทดสอบ…");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const runId = useRef(0);
  const delay = useRef<ReturnType<typeof setTimeout>>();
  const cancel = () => { runId.current++; clearTimeout(delay.current); delay.current = undefined; setBusy(false); };
  const refresh = async () => {
    const [account, data] = await Promise.all([api("test-user"), api("test-user/factors")]);
    setUser(account); setFactors(data.factors); setPrimary(data.primaryFactorId); setPrimaryTotp(data.primaryTotpFactorId ?? "");
    setSelected(previous => data.factors.some((factor: Factor) => factor.id === previous) ? previous : data.primaryFactorId ?? data.factors.find((factor: Factor) => factor.status === "ACTIVE")?.id ?? "");
    setMessage("ข้อมูลล่าสุดจาก Okta — ยังไม่ได้ส่ง Push");
  };
  async function perform(action: () => Promise<void>) {
    if (busy) return;
    setError(""); setBusy(true);
    try { await action(); } catch (err) { setError(err instanceof Error ? err.message : "ทำรายการไม่สำเร็จ"); }
    finally { setBusy(false); }
  }
  useEffect(() => { void perform(refresh); return cancel; }, []);
  const chosen = factors.find(factor => factor.id === selected);
  const eligible = factors.filter(factor => factor.provider === "OKTA" && ["push", "token:software:totp"].includes(factor.factorType));
  async function verify() {
    if (!chosen) return;
    const generation = ++runId.current;
    const data: Transaction = await api(`test-user/factors/${chosen.id}/verify`, chosen.factorType === "push" ? {} : { passCode: code });
    if (generation !== runId.current) return;
    setCode(""); setTransaction(data); setMessage(data.factorResult ?? data.status ?? "ส่งคำขอแล้ว");
    if (!data.transactionId || data.factorResult !== "WAITING") { setBusy(false); return; }
    // Poll only this user/factor/transaction; no arbitrary URL from the browser reaches SSWS.
    const start = Date.now();
    const poll = async () => {
      if (generation !== runId.current) return;
      try {
        const update: Transaction = await api(`test-user/factors/${chosen.id}/transactions/${data.transactionId}`);
        if (generation !== runId.current) return;
        setTransaction(update); setMessage(update.factorResult ?? update.status ?? "กำลังตรวจสอบ");
        if (update.factorResult === "WAITING" && Date.now() - start < 120000) delay.current = setTimeout(poll, 2500);
        else { setBusy(false); if (update.factorResult === "WAITING") setMessage("ครบเวลารอแล้ว ตรวจสถานะใน Okta ก่อนส่งคำขอใหม่"); }
      } catch (err) { setBusy(false); setError(err instanceof Error ? err.message : "อ่านสถานะไม่สำเร็จ"); }
    };
    setBusy(true); delay.current = setTimeout(poll, 2500);
  }
  return <>
    <section className="mfa-toolbar card"><div><span className="eyebrow">Test account · owner only</span><h2>{user?.login ?? "MFA Console"}</h2><p>{user?.status ?? "เข้าสู่ระบบด้วยบัญชีที่กำหนดใน OKTA_TEST_USER_ID"}</p></div><button className="button secondary" disabled={busy} onClick={() => void perform(refresh)}>รีเฟรชข้อมูล</button></section>
    <div role="status" aria-live="polite" className="mfa-message">{message}</div>
    {error && <div role="alert" className="mfa-error">{error}</div>}
    <section className="mfa-grid">
      <article className="card"><span className="eyebrow">01 · Devices</span><h2>อุปกรณ์และ Primary</h2><p>เลือก Push factor ที่ต้องการใช้ใน API Demo หากมีสองเครื่องจะเลือกได้แยกกัน</p>
        <ul className="factor-list">{factors.map(factor => <li key={factor.id}><strong>{factor.factorType} {factor.id === primary && <span className="factor-badge">Primary</span>}</strong><small>{factor.device ?? "Okta Verify"} · {factor.id} · {factor.status}</small>{factor.factorType === "push" && factor.status === "ACTIVE" && <button className="button secondary" disabled={busy || factor.id === primary} onClick={() => void perform(async () => { await api("test-user/primary", { factorId: factor.id }); await refresh(); setSelected(factor.id); setTransaction(undefined); })}>{factor.id === primary ? "เลือกแล้ว" : "ใช้เป็น Primary"}</button>}</li>)}</ul>
        {!factors.length && <p>ยังไม่มี factor หรือยังโหลดข้อมูลไม่ได้</p>}
        <label htmlFor="primary-totp">TOTP บนอุปกรณ์ Primary (เจ้าของต้องยืนยันว่าเป็นเครื่องเดียวกัน)</label><select id="primary-totp" value={primaryTotp} disabled={busy} onChange={event => setPrimaryTotp(event.target.value)}><option value="">ยังไม่จับคู่</option>{eligible.filter(factor => factor.factorType === "token:software:totp" && factor.status === "ACTIVE").map(factor => <option key={factor.id} value={factor.id}>{factor.device ?? factor.id} · {factor.id}</option>)}</select><button className="button secondary" disabled={busy || !primary} onClick={() => void perform(async () => { await api("test-user/primary", { factorId: primary, totpFactorId: primaryTotp || null }); await refresh(); setMessage("บันทึกการจับคู่ TOTP ของ Primary แล้ว"); })}>บันทึกการจับคู่ TOTP</button>
        <p className="claim-note">Primary และการจับคู่ TOTP บันทึกใน PostgreSQL ของ POC ใช้กับ API เท่านั้น ไม่เปลี่ยนพฤติกรรมส่งแจ้งเตือนของ Okta Hosted Sign-In และไม่ถือว่าพิสูจน์สองเครื่องแล้วจากการเลือกในหน้านี้</p>
      </article>
      <article className="card"><span className="eyebrow">02 · Verification</span><h2>ทดสอบ Push / TOTP</h2>
        <label htmlFor="factor">อุปกรณ์ / Factor</label><select id="factor" value={selected} disabled={busy} onChange={event => { setSelected(event.target.value); setTransaction(undefined); }}><option value="">เลือก factor</option>{eligible.map(factor => <option key={factor.id} value={factor.id}>{factor.factorType} · {factor.device ?? factor.id} · {factor.id} · {factor.status}</option>)}</select>
        <div className="actions"><button className="button secondary" disabled={busy || !primary} onClick={() => { setSelected(primary!); setTransaction(undefined); }}>ใช้ Push ของ Primary</button><button className="button secondary" disabled={busy || !primaryTotp} onClick={() => { setSelected(primaryTotp); setTransaction(undefined); }}>ใช้ TOTP ของ Primary</button></div>
        {chosen?.factorType === "token:software:totp" && <><label htmlFor="otp">รหัสจาก Okta Verify</label><input id="otp" autoComplete="one-time-code" inputMode="numeric" maxLength={8} value={code} onChange={event => setCode(event.target.value.replace(/\D/g, ""))} /></>}
        <div className="actions"><button className="button" disabled={busy || !chosen || chosen.status !== "ACTIVE" || (chosen.factorType !== "push" && code.length < 6)} onClick={() => { setBusy(true); setError(""); void verify().catch(err => { setError(err.message); setBusy(false); }); }}>{chosen?.factorType === "push" ? "ส่ง Push ไปอุปกรณ์นี้" : "ตรวจสอบรหัส TOTP"}</button>{busy && <button className="button secondary" onClick={cancel}>หยุดรอ</button>}</div>
        {transaction && <div className="verification-result"><strong>{transaction.factorResult ?? transaction.status}</strong>{transaction.correctAnswer !== undefined && <p>เลือกหมายเลขนี้บน Okta Verify: <b className="challenge-number">{transaction.correctAnswer}</b></p>}</div>}
        <p className="claim-note">ไม่สร้างหมายเลขขึ้นเอง Number Matching จะแสดงเมื่อ Okta ส่ง challenge กลับมาจริงเท่านั้น การกดส่ง Push เป็นการแจ้งเตือนเจ้าของอุปกรณ์</p>
      </article>
      <article className="card"><span className="eyebrow">03 · Enrollment</span><h2>เพิ่ม Okta Verify</h2><p>ใช้เฉพาะเมื่อเจ้าของบัญชีต้องการเพิ่มอุปกรณ์ อาจถูก policy จำกัดจำนวนอุปกรณ์ การสแกน QR ต้องทำด้วยมือถือจริง</p>
        <div className="actions"><button className="button secondary" disabled={busy} onClick={() => void perform(async () => { setEnrollment(await api("test-user/factors", { factorType: "push", provider: "OKTA" })); setMessage("เปิด Okta Verify แล้วสแกน QR; จากนั้นกดรีเฟรชข้อมูล"); })}>เริ่มเพิ่ม Push</button><button className="button secondary" disabled={busy} onClick={() => void perform(async () => { setEnrollment(await api("test-user/factors", { factorType: "token:software:totp", provider: "OKTA" })); })}>เริ่มเพิ่ม TOTP</button></div>
        {enrollment && <div className="enrollment"><p>{enrollment.factorType} · {enrollment.status}</p>{enrollment.activation?.qrCode && <img src={enrollment.activation.qrCode} alt="QR สำหรับลงทะเบียน Okta Verify ของบัญชีคุณ ห้ามแชร์" width={220} height={220} referrerPolicy="no-referrer" />}<p>QR เป็นข้อมูลลับ ไม่ควรถ่ายลงหลักฐานหรือแชร์กับผู้อื่น</p>{enrollment.factorType === "token:software:totp" && enrollment.status !== "ACTIVE" && <><label htmlFor="activation-code">รหัสเปิดใช้งาน</label><input id="activation-code" inputMode="numeric" autoComplete="one-time-code" maxLength={8} value={activationCode} onChange={event => setActivationCode(event.target.value.replace(/\D/g, ""))} /><button className="button" disabled={busy || activationCode.length < 6} onClick={() => void perform(async () => { await api(`test-user/factors/${enrollment.id}/activate`, { passCode: activationCode }); setActivationCode(""); setEnrollment(undefined); await refresh(); setMessage("Activate สำเร็จ"); })}>Activate TOTP</button></>}</div>}
      </article>
    </section>
  </>;
}
