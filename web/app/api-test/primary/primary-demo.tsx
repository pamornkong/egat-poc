"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

type Method = "push" | "totp";
type Factor = { id: string; factorType: string; provider: string; status: string; device?: string };
type Transaction = { factorResult?: string; status?: string; correctAnswer?: number; transactionId?: string; expiresAt?: string };
type Verification = { method: Method; factorId: string; tor: string; request: { method: string; path: string; body: unknown }; upstreamStatus: number; verifiedAt: string; result?: Transaction; error?: string };
type Trace = { time: string; endpoint: string; httpStatus: number; response: unknown };
type Result = { state: string; factorId?: string; challenge?: number; trace: Trace[]; startedAt?: string; completedAt?: string };
const idle = (): Result => ({ state: "IDLE", trace: [] });
const base = "/api/okta/test-user";
const labels: Record<string, string> = {
  IDLE: "พร้อมเริ่มทดสอบ", RUNNING: "กำลังเรียก REST API…", WAITING: "รอยืนยันใน Okta Verify", SUCCESS: "ยืนยันสำเร็จ",
  REJECTED: "ผู้ใช้ปฏิเสธคำขอ", TIMEOUT: "หมดเวลารอผล", EXPIRED: "คำขอหมดอายุ", STOPPED: "หยุดติดตามผลแล้ว", ERROR: "ทำรายการไม่สำเร็จ", INCOMPLETE: "ยังยืนยันผลไม่ได้"
};

async function call(path: string, body?: unknown, signal?: AbortSignal) {
  const response = await fetch(base + path, {
    method: body === undefined ? "GET" : "POST", cache: "no-store", credentials: "same-origin", signal,
    headers: body === undefined ? {} : { "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body)
  });
  const data = await response.json();
  return { response, data };
}

export default function PrimaryDemo() {
  const [account, setAccount] = useState("");
  const [factors, setFactors] = useState<Factor[]>([]);
  const [primary, setPrimary] = useState("");
  const [primaryTotp, setPrimaryTotp] = useState("");
  const [draftPush, setDraftPush] = useState("");
  const [draftTotp, setDraftTotp] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [code, setCode] = useState("");
  const [active, setActive] = useState<Method | null>(null);
  const [results, setResults] = useState<Record<Method, Result>>({ push: idle(), totp: idle() });
  const lock = useRef(false);
  const generation = useRef(0);
  const controller = useRef<AbortController>();
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const busy = loading || saving || active !== null;
  const pushes = factors.filter(factor => factor.status === "ACTIVE" && factor.provider === "OKTA" && factor.factorType === "push");
  const totps = factors.filter(factor => factor.status === "ACTIVE" && factor.provider === "OKTA" && factor.factorType === "token:software:totp");
  const readyPush = pushes.some(factor => factor.id === primary);
  const readyTotp = totps.some(factor => factor.id === primaryTotp);
  const deviceName = (id: string) => factors.find(factor => factor.id === id)?.device ?? "Okta Verify";
  const patch = (method: Method, changes: Partial<Result>) => setResults(previous => ({ ...previous, [method]: { ...previous[method], ...changes } }));

  async function load(signal?: AbortSignal) {
    const [user, devices] = await Promise.all([call("", undefined, signal), call("/factors", undefined, signal)]);
    if (!user.response.ok || !devices.response.ok) throw new Error(user.data.error ?? devices.data.error ?? "โหลดข้อมูลไม่ได้");
    setAccount(user.data.login); setFactors(devices.data.factors);
    setPrimary(devices.data.primaryFactorId ?? ""); setPrimaryTotp(devices.data.primaryTotpFactorId ?? "");
    const eligible = devices.data.factors.filter((factor: Factor) => factor.status === "ACTIVE" && factor.provider === "OKTA");
    const pushList = eligible.filter((factor: Factor) => factor.factorType === "push");
    const totpList = eligible.filter((factor: Factor) => factor.factorType === "token:software:totp");
    setDraftPush(devices.data.primaryFactorId ?? (pushList.length === 1 ? pushList[0].id : ""));
    setDraftTotp(devices.data.primaryTotpFactorId ?? (totpList.length === 1 ? totpList[0].id : ""));
    setConfirmed(false);
    setEditing(!pushList.some((factor: Factor) => factor.id === devices.data.primaryFactorId) || !totpList.some((factor: Factor) => factor.id === devices.data.primaryTotpFactorId));
  }
  useEffect(() => {
    const abort = new AbortController();
    void load(abort.signal).catch(err => { if (!abort.signal.aborted) setError(err.message); }).finally(() => { if (!abort.signal.aborted) setLoading(false); });
    return () => { abort.abort(); generation.current++; controller.current?.abort(); clearTimeout(timer.current); };
  }, []);

  async function refresh() {
    if (lock.current) return;
    setLoading(true); setError("");
    try { await load(); } catch (err) { setError(err instanceof Error ? err.message : "โหลดไม่สำเร็จ"); }
    finally { setLoading(false); }
  }
  async function save() {
    if (busy || !draftPush || (draftTotp && !confirmed)) return;
    setSaving(true); setError("");
    try {
      const { response, data } = await call("/primary", { factorId: draftPush, totpFactorId: draftTotp || null });
      if (!response.ok) throw new Error(data.error ?? "บันทึกไม่ได้");
      setPrimary(data.primaryFactorId); setPrimaryTotp(data.primaryTotpFactorId ?? ""); setEditing(false); setConfirmed(false);
      setResults({ push: idle(), totp: idle() });
    } catch (err) { setError(err instanceof Error ? err.message : "บันทึกไม่สำเร็จ"); }
    finally { setSaving(false); }
  }
  function stop() {
    generation.current++; clearTimeout(timer.current); controller.current?.abort(); lock.current = false;
    if (active) patch(active, { state: "STOPPED", completedAt: new Date().toISOString() });
    setActive(null);
  }
  async function verify(method: Method) {
    if (lock.current || busy || editing || (method === "push" ? !readyPush : !readyTotp || !/^\d{6}$/.test(code))) return;
    lock.current = true; setActive(method); setError("");
    const run = ++generation.current;
    const abort = new AbortController(); controller.current = abort;
    const startedAt = new Date().toISOString();
    const trace: Trace[] = [];
    patch(method, { state: "RUNNING", trace: [], factorId: undefined, challenge: undefined, startedAt, completedAt: undefined });
    const finish = (state: string) => {
      if (generation.current !== run) return;
      patch(method, { state, trace: [...trace], completedAt: new Date().toISOString() });
      lock.current = false; setActive(null);
    };
    try {
      // Read the code once and clear it immediately. Traces never keep the submitted code.
      const payload = method === "push" ? { method } : { method, passCode: code };
      setCode("");
      const { response, data }: { response: Response; data: Verification & { error?: string } } = await call("/primary/verify", payload, abort.signal);
      if (generation.current !== run) return;
      trace.push({ time: new Date().toISOString(), endpoint: "POST " + base + "/primary/verify", httpStatus: response.status, response: data });
      patch(method, { trace: [...trace], factorId: data.factorId });
      if (!response.ok) { setError(data.error ?? "Okta ไม่รับคำขอนี้"); finish("ERROR"); return; }
      const state = data.result?.factorResult;
      patch(method, { challenge: data.result?.correctAnswer });
      if (state !== "WAITING") { finish(state ?? "INCOMPLETE"); return; }
      const transaction = data.result?.transactionId;
      if (!transaction) { setError("Okta ส่งสถานะ WAITING แต่ไม่มี transaction สำหรับติดตามผล กรุณาตรวจ System Log"); finish("INCOMPLETE"); return; }
      patch(method, { state: "WAITING" });
      const deadline = Math.min(Date.now() + 120000, Date.parse(data.result?.expiresAt ?? "") || Infinity);
      const poll = async () => {
        if (generation.current !== run) return;
        if (Date.now() >= deadline) { finish("TIMEOUT"); return; }
        try {
          const path = `/factors/${encodeURIComponent(data.factorId)}/transactions/${encodeURIComponent(transaction)}`;
          const polled = await call(path, undefined, abort.signal);
          if (generation.current !== run) return;
          trace.push({ time: new Date().toISOString(), endpoint: "GET " + base + path, httpStatus: polled.response.status, response: polled.data });
          patch(method, { trace: [...trace], challenge: polled.data.correctAnswer ?? data.result?.correctAnswer });
          if (!polled.response.ok) { setError(polled.data.error ?? "อ่านผลจาก Okta ไม่สำเร็จ"); finish("ERROR"); return; }
          if (polled.data.factorResult === "WAITING") timer.current = setTimeout(poll, 2500);
          else finish(polled.data.factorResult ?? "INCOMPLETE");
        } catch (err) {
          if (generation.current === run) { setError(err instanceof Error ? err.message : "อ่านผลไม่สำเร็จ"); finish("ERROR"); }
        }
      };
      timer.current = setTimeout(poll, 2500);
    } catch (err) {
      if (generation.current === run) { setError(err instanceof Error ? err.message : "เรียก API ไม่สำเร็จ"); finish("ERROR"); }
    }
  }
  function download() {
    const evidence = { account, generatedAt: new Date().toISOString(), primaryIsApplicationPreference: true,
      notice: "ผล REST API ไม่ใช่การรับรอง TOR; TOTP เป็น verification ไม่ใช่ส่ง OTP ไปมือถือ; ไม่มี passCode/SSWS ในรายงาน", results };
    const url = URL.createObjectURL(new Blob([JSON.stringify(evidence, null, 2)], { type: "application/json" }));
    const link = document.createElement("a"); link.href = url; link.download = "egat-primary-mfa-demo.json"; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function status(method: Method) {
    const result = results[method];
    return <div className={"primary-demo-result result-" + result.state.toLowerCase()} role="status" aria-live="polite" data-testid={method + "-result"}>
      <span className="demo-result-icon" aria-hidden="true">{result.state === "SUCCESS" ? "✓" : result.state === "ERROR" || result.state === "REJECTED" ? "!" : "·"}</span>
      <div><strong>{labels[result.state] ?? result.state}</strong><small>{result.state === "IDLE" ? "ยังไม่มีผลการทดสอบในรอบนี้" : result.state === "STOPPED" ? "หยุด polling เท่านั้น คำขอที่ Okta อาจยังรออยู่" : result.state === "TIMEOUT" ? "หมดเวลาติดตามในแอป ตรวจสถานะคำขอที่ Okta ก่อนส่งใหม่" : result.state}</small></div>
    </div>;
  }
  function details(method: Method) {
    const result = results[method];
    return <>
      {result.factorId && <p className="demo-target">เป้าหมายที่ API ใช้จริง <code>{result.factorId}</code></p>}
      {result.completedAt && <p className="demo-target">อัปเดต {new Date(result.completedAt).toLocaleTimeString("th-TH", { timeZone: "Asia/Bangkok" })} · Asia/Bangkok</p>}
      <details className="demo-trace" data-testid={method + "-trace"}><summary>REST request / response {result.trace.length > 0 ? `(${result.trace.length} รายการ)` : "· ยังไม่ได้เรียก"}</summary>
        <p>Browser เรียก API ของ POC → Server อ่าน Primary จาก PostgreSQL → ส่ง REST ไป Okta โดยไม่เปิดเผย SSWS token หรือรหัส TOTP</p>
        {!result.trace.length && <pre>{JSON.stringify({ method: "POST", endpoint: base + "/primary/verify", body: method === "push" ? { method: "push" } : { method: "totp", passCode: "[กรอกจากมือถือ · ปกปิดในรายงาน]" }, note: "ตัวอย่าง request เท่านั้น ยังไม่มีผลจริง" }, null, 2)}</pre>}
        {result.trace.map((entry, index) => <div className="demo-trace-entry" key={index}><small>{entry.endpoint} · HTTP {entry.httpStatus}</small><pre>{JSON.stringify(entry.response, null, 2)}</pre></div>)}
      </details>
    </>;
  }
  return <>
    <section className="primary-demo-account card"><div><span className="eyebrow">Demo account · owner only</span><h2>{account || (loading ? "กำลังโหลดบัญชี…" : "ยังโหลดบัญชีไม่ได้")}</h2><p>ตั้งค่า Primary ครั้งเดียว แล้วใช้สองปุ่มด้านล่างได้เลย</p></div><button className="button secondary" disabled={busy} onClick={() => void refresh()}>รีเฟรชข้อมูล</button></section>
    {error && <div className="mfa-error" role="alert">{error} <Link href="/">กลับหน้าเข้าสู่ระบบ</Link></div>}
    <section className="card primary-setup" aria-label="ตั้งค่า Primary">
      <div className="primary-setup-heading"><div><span className="eyebrow">01 · Select once</span><h2>อุปกรณ์ Primary</h2></div><span className={"demo-readiness " + (readyPush && readyTotp ? "is-ready" : "")}>{loading ? "กำลังตรวจ…" : readyPush && readyTotp ? "พร้อมเดโมทั้ง 2 ข้อ" : "ตั้งค่าอุปกรณ์ก่อนเริ่ม"}</span></div>
      <div className="primary-selected"><div><small>Push destination</small><strong>{readyPush ? deviceName(primary) : "ยังไม่ได้เลือก"}</strong><code>{primary || "—"}</code></div><div><small>TOTP บนเครื่องเดียวกัน</small><strong>{readyTotp ? deviceName(primaryTotp) : "ยังไม่จับคู่"}</strong><code>{primaryTotp || "—"}</code></div></div>
      {!editing && <button className="button secondary" disabled={busy} onClick={() => { setDraftPush(primary); setDraftTotp(primaryTotp); setConfirmed(false); setEditing(true); }}>เปลี่ยน Primary / จับคู่ TOTP</button>}
      {editing && <div className="primary-setup-form"><label>อุปกรณ์รับ Push<select id="demo-push-device" value={draftPush} disabled={busy} onChange={event => { setDraftPush(event.target.value); setConfirmed(false); }}><option value="">เลือกอุปกรณ์</option>{pushes.map(factor => <option key={factor.id} value={factor.id}>{factor.device ?? "Okta Verify"} · {factor.id}</option>)}</select></label>
        <label>TOTP ของอุปกรณ์ Primary<select id="demo-totp-device" value={draftTotp} disabled={busy} onChange={event => { setDraftTotp(event.target.value); setConfirmed(false); }}><option value="">ยังไม่จับคู่ — เดโม Push ก่อน</option>{totps.map(factor => <option key={factor.id} value={factor.id}>{factor.device ?? "Okta Verify"} · {factor.id}</option>)}</select></label>
        {draftTotp && <label className="demo-confirm"><input id="demo-confirm-pair" type="checkbox" checked={confirmed} disabled={busy} onChange={event => setConfirmed(event.target.checked)} /><span>ยืนยันว่า Push และ TOTP ที่เลือกอยู่ในอุปกรณ์ Primary เครื่องเดียวกัน</span></label>}
        <div className="actions"><button className="button" id="demo-save-primary" disabled={busy || !draftPush || Boolean(draftTotp && !confirmed)} onClick={() => void save()}>{saving ? "กำลังบันทึก…" : "บันทึก Primary"}</button><Link href="/api-test">ไม่มีอุปกรณ์? ไปเพิ่ม Okta Verify →</Link></div>
      </div>}
      <p className="demo-caption">Primary นี้เป็นค่าของ POC สำหรับเลือก REST API ปลายทาง ไม่เปลี่ยน default device ของหน้า Okta และระบบไม่เดาว่า Push/TOTP เป็นเครื่องเดียวกันแทนเจ้าของ</p>
    </section>
    <section className="primary-demo-cards">
      <article className="card primary-action-card" aria-labelledby="push-demo-title"><div className="demo-case-heading"><span className="demo-case-number">05</span><span className="eyebrow">TOR 3.5 · ผนวก 2 ข้อ 12.1</span></div><h2 id="push-demo-title">ส่ง Push ไป Primary</h2><p>กดส่ง → ดูหมายเลขบนเว็บ → เลือกหมายเลขเดียวกันใน Okta Verify → รอผลอัตโนมัติ</p>
        <div className="demo-device-line">ส่งถึง <strong>{readyPush ? deviceName(primary) : "ยังไม่ได้เลือก Primary"}</strong></div>
        <button className="button demo-main-button" id="demo-send-push" disabled={busy || editing || !readyPush} onClick={() => void verify("push")}>ส่ง Push ไป Primary →</button>
        {active === "push" && <button className="button secondary" onClick={stop}>หยุดรอผล (ไม่ยกเลิกคำขอที่ Okta)</button>}
        {results.push.state === "WAITING" && results.push.challenge !== undefined && <div className="primary-number-challenge"><span>เลือกหมายเลขนี้ใน Okta Verify</span><strong data-testid="primary-challenge">{results.push.challenge}</strong><small>หมายเลขที่ Okta ส่งกลับจริง ไม่สร้างขึ้นเองในแอป</small></div>}
        {status("push")}{details("push")}
      </article>
      <article className="card primary-action-card" aria-labelledby="totp-demo-title"><div className="demo-case-heading"><span className="demo-case-number">06</span><span className="eyebrow">TOR 3.6 · ผนวก 2 ข้อ 12.2</span></div><h2 id="totp-demo-title">ตรวจ TOTP ของ Primary</h2><p>เปิด Okta Verify บนเครื่อง Primary → อ่านรหัส 6 หลักล่าสุด → กรอกและกดตรวจผ่าน REST API</p>
        <label className="demo-otp-label" htmlFor="demo-totp-code">รหัส TOTP จากอุปกรณ์ Primary</label><input id="demo-totp-code" className="demo-otp-input" type="password" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} placeholder="••••••" value={code} disabled={busy || editing || !readyTotp} onChange={event => setCode(event.target.value.replace(/\D/g, ""))} onKeyDown={event => { if (event.key === "Enter") { event.preventDefault(); void verify("totp"); } }} />
        <button className="button demo-main-button" id="demo-verify-totp" disabled={busy || editing || !readyTotp || !/^\d{6}$/.test(code)} onClick={() => void verify("totp")}>ตรวจ TOTP ผ่าน REST API →</button>
        <p className="demo-caption">TOTP สร้างรหัสบนมือถือเอง API ใช้ตรวจรหัส ไม่ส่งรหัสไปมือถือ ไม่สร้างรหัสแทนผู้ใช้ และไม่เก็บรหัสลงรายงาน</p>
        {status("totp")}{details("totp")}
      </article>
    </section>
    <section className="card primary-demo-footer"><div><span className="eyebrow">03 · Show the evidence</span><h2>พร้อมแสดง Source และผล API</h2><p>ผลแต่ละข้อเก็บแยกกันในหน้านี้ ดาวน์โหลดรายงานก่อน refresh ได้ โดยปกปิดรหัส TOTP และไม่บันทึกเป็นผลผ่าน TOR อัตโนมัติ</p></div><div className="actions"><Link href="/api-test/primary/source" target="_blank" rel="noopener noreferrer">เปิด Source code ↗</Link><button className="button secondary" disabled={busy || ![results.push, results.totp].some(result => result.trace.length)} onClick={download}>ดาวน์โหลดผล JSON</button></div></section>
  </>;
}
