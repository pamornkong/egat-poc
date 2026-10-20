import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { createRequire } from "node:module";
import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve, join } from "node:path";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { setTimeout as pause } from "node:timers/promises";

const root = resolve(import.meta.dirname, "..");
let WebSocket;
for (const folder of ["web", "mobile"]) { try { WebSocket = createRequire(join(root, folder, "package.json"))("ws"); break; } catch {} }
if (!WebSocket) throw new Error("Install web or mobile dependencies first (ws is required)");
const profileDir = await mkdtemp(join(tmpdir(), "egat-browser-check-"));
const output = resolve(process.env.POC_EVIDENCE_DIR ?? join(root, "docs/evidence/browser-local"));
await mkdir(output, { recursive: true });
const chrome = spawn(process.env.CHROME_BIN ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", [
  "--headless=new", "--remote-debugging-port=0", "--no-first-run", "--no-default-browser-check", "--disable-extensions", "--disable-background-networking", "--user-data-dir=" + profileDir, "about:blank"
], { stdio: "ignore" });
let socket;
const report = { kind: "LOCAL_FIXTURE_BROWSER_TEST_NOT_REAL_OKTA_LOGIN", cases: [], capturedAt: new Date().toISOString() };
try {
  let port;
  for (let i = 0; i < 100; i++) { try { port = (await readFile(join(profileDir, "DevToolsActivePort"), "utf8")).split("\n")[0]; break; } catch { await pause(100); } }
  if (!port) throw new Error("Chrome did not start");
  const tabs = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  socket = new WebSocket(tabs.find(tab => tab.type === "page").webSocketDebuggerUrl);
  await once(socket, "open");
  let id = 0; const pending = new Map(); let mockPrimary = "fixturePushDevice1"; let mockPrimaryTotp = null;
  let primaryCalls = 0; let pollOutcome = "SUCCESS";
  const call = (method, params = {}) => new Promise((resolve, reject) => { const key = ++id; pending.set(key, { resolve, reject }); socket.send(JSON.stringify({ id: key, method, params })); });
  socket.on("message", async raw => {
    const message = JSON.parse(raw.toString());
    if (message.id) { const item = pending.get(message.id); pending.delete(message.id); if (message.error) item?.reject(new Error(message.error.message)); else item?.resolve(message.result); }
    if (message.method === "Fetch.requestPaused") {
      // Intercept all MFA requests: NEVER enroll, send push or write a real preference in fixture tests.
      const { requestId, request } = message.params;
      const path = new URL(request.url).pathname;
      let data = { error: "Fixture endpoint not implemented" }; let responseCode = 200;
      if (path.endsWith("/test-user")) data = { login: "ui-fixture@example.invalid", status: "LOCAL FIXTURE" };
      if (path.endsWith("/test-user/factors")) data = { primaryFactorId: mockPrimary, primaryTotpFactorId: mockPrimaryTotp, factors: [
        { id: "fixturePushDevice1", factorType: "push", provider: "OKTA", status: "ACTIVE", device: "Fixture device 1" },
        { id: "fixturePushDevice2", factorType: "push", provider: "OKTA", status: "ACTIVE", device: "Fixture device 2" },
        { id: "fixtureTotpDevice1", factorType: "token:software:totp", provider: "OKTA", status: "ACTIVE", device: "Fixture TOTP" }
      ] };
      if (path.endsWith("/primary")) { const body = JSON.parse(request.postData); mockPrimary = body.factorId; mockPrimaryTotp = body.totpFactorId ?? null; data = { primaryFactorId: mockPrimary, primaryTotpFactorId: mockPrimaryTotp }; }
      if (path.endsWith("/verify")) data = request.postData?.includes("passCode") ? { factorResult: "SUCCESS" } : { factorResult: "WAITING", transactionId: "fixtureTransaction1", correctAnswer: 42 };
      if (path.endsWith("/primary/verify")) {
        primaryCalls++;
        const body = JSON.parse(request.postData); const factor = body.method === "push" ? mockPrimary : mockPrimaryTotp;
        const invalid = body.method === "totp" && body.passCode === "000000";
        responseCode = invalid ? 403 : 200;
        data = { method: body.method, factorId: factor, tor: body.method === "push" ? "3.5 / 12.1" : "3.6 / 12.2",
          request: { method: "POST", path: `/api/v1/users/fixture-user/factors/${factor}/verify`, body: body.method === "push" ? { useNumberMatchingChallenge: true } : { passCode: "[REDACTED]" } },
          upstreamStatus: invalid ? 403 : body.method === "push" ? 201 : 200, verifiedAt: new Date().toISOString(),
          result: invalid ? undefined : body.method === "push" ? { factorResult: "WAITING", transactionId: "fixtureTransaction1", correctAnswer: 42 } : { factorResult: "SUCCESS" },
          error: invalid ? "Fixture: รหัส TOTP ไม่ถูกต้อง" : undefined };
      }
      if (path.includes("/transactions/")) data = { factorResult: pollOutcome };
      try {
        await call("Fetch.fulfillRequest", { requestId, responseCode, responseHeaders: [{ name: "Content-Type", value: "application/json" }], body: Buffer.from(JSON.stringify(data)).toString("base64") });
      } catch (error) {
        // React Strict Mode may abort its first mount's read-only fetch before the response is fulfilled.
        if (!error.message.includes("Invalid InterceptionId")) throw error;
      }
    }
  });
  await call("Page.enable"); await call("Network.enable");
  const evaluate = async expression => { const result = await call("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true }); if (result.exceptionDetails) throw new Error(result.exceptionDetails.text); return result.result.value; };
  const until = async expression => { for (let i = 0; i < 100; i++) { if (await evaluate(expression)) return; await pause(150); } throw new Error("Timed out: " + expression); };
  const navigate = async url => { await call("Page.navigate", { url }); await until("document.readyState === 'complete'"); await pause(300); };
  const shot = async name => { const { data } = await call("Page.captureScreenshot", { format: "png", captureBeyondViewport: false }); await writeFile(join(output, name), Buffer.from(data, "base64")); };
  const click = async selector => { const rectangle = await evaluate(`(()=>{const r=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`); await call("Input.dispatchMouseEvent", { type: "mousePressed", button: "left", clickCount: 1, ...rectangle }); await call("Input.dispatchMouseEvent", { type: "mouseReleased", button: "left", clickCount: 1, ...rectangle }); };
  await call("Emulation.setDeviceMetricsOverride", { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
  const brand = "file://" + join(root, "docs/branding/okta-brand-assets.html");
  await navigate(brand);
  await call("Emulation.setDeviceMetricsOverride", { width: 600, height: 200, deviceScaleFactor: 1, mobile: false });
  await call("Emulation.setDefaultBackgroundColorOverride", { color: { r: 0, g: 0, b: 0, a: 0 } });
  const logo = await call("Page.captureScreenshot", { format: "png" }); await mkdir(join(root, "docs/branding/assets"), { recursive: true }); await writeFile(join(root, "docs/branding/assets/logo.png"), Buffer.from(logo.data, "base64"));
  await call("Emulation.setDeviceMetricsOverride", { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false });
  await navigate(brand + "#background");
  const background = await call("Page.captureScreenshot", { format: "png" }); await writeFile(join(root, "docs/branding/assets/background.png"), Buffer.from(background.data, "base64"));
  await call("Emulation.setDeviceMetricsOverride", { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
  await navigate("http://localhost:3000/");
  assert.equal(await evaluate("Boolean(document.querySelector('.account-menu'))"), false);
  report.cases.push("Unauthenticated home hides account menu");
  const env = Object.fromEntries((await readFile(join(root, ".env.local"), "utf8")).split(/\r?\n/).flatMap(line => { const match = line.match(/^([A-Z0-9_]+)=(.*)$/); return match ? [[match[1], match[2]]] : []; }));
  const jwt = payload => { const encode = value => Buffer.from(JSON.stringify(value)).toString("base64url"); const unsigned = encode({ alg: "HS256" }) + "." + encode({ ...payload, iat: Math.floor(Date.now()/1000), exp: Math.floor(Date.now()/1000)+600 }); return unsigned + "." + createHmac("sha256", env.SESSION_SECRET).update(unsigned).digest("base64url"); };
  for (const protocol of ["oidc", "saml"]) {
    const payload = protocol === "saml" ? { protocol, nameId: "ui-fixture@example.invalid", attributes: { email: ["ui-fixture@example.invalid"], name: ["LOCAL FIXTURE · ไม่ใช่ Login จริง"], employee_code: ["FIXTURE001"], department: ["UI TEST"] } } : { sub: "fixture-subject", preferred_username: "ui-fixture@example.invalid", email: "ui-fixture@example.invalid", name: "LOCAL FIXTURE · ไม่ใช่ Login จริง", employee_code: "FIXTURE001", department: "UI TEST" };
    await call("Network.setCookie", { name: "egat_poc_session", value: jwt(payload), url: "http://localhost:3000", httpOnly: true, sameSite: "Lax" });
    await navigate("http://localhost:3000/success");
    await until("Boolean(document.querySelector('.account-menu'))");
    await click(".account-menu>summary");
    assert.equal(await evaluate("document.querySelector('.account-menu').open"), true);
    await evaluate("document.querySelector('.account-menu>summary').focus()");
    await call("Input.dispatchKeyEvent", { type: "keyDown", key: " ", code: "Space", windowsVirtualKeyCode: 32 });
    await call("Input.dispatchKeyEvent", { type: "keyUp", key: " ", code: "Space", windowsVirtualKeyCode: 32 });
    assert.equal(await evaluate("document.querySelector('.account-menu').open"), false);
    await click(".account-menu>summary"); await shot(`${protocol}-desktop-fixture.png`);
    report.cases.push(`${protocol}: pointer open, Space close, profile account/custom claims render`);
    assert.equal(await evaluate("document.querySelector('#account').innerText.includes('FIXTURE001')"), true);
    await call("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
    await evaluate("window.scrollTo(0,0)"); await pause(200);
    assert.equal(await evaluate("document.documentElement.scrollWidth <= 390"), true);
    await shot(`${protocol}-mobile-fixture.png`);
    report.cases.push(`${protocol}: 390px viewport no horizontal overflow`);
    await call("Emulation.setDeviceMetricsOverride", { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
  }
  await call("Fetch.enable", { patterns: [{ urlPattern: "http://localhost:3000/api/okta/*", requestStage: "Request" }] });
  await navigate("http://localhost:3000/api-test");
  await until("document.querySelectorAll('.factor-list li').length === 3");
  await evaluate("[...document.querySelectorAll('.factor-list button')].find(b=>!b.disabled).click()");
  await until("document.querySelector('#factor')?.value === 'fixturePushDevice2'");
  report.cases.push("MFA UI: mocked Primary selection changes verification target; no real preference written");
  await evaluate("[...document.querySelectorAll('button')].find(b=>b.textContent.includes('ส่ง Push')).click()");
  await until("document.querySelector('.challenge-number')?.textContent === '42'");
  report.cases.push("MFA UI: mocked Number Matching from response (no actual push sent)");
  await until("document.querySelector('.verification-result')?.innerText.includes('SUCCESS')");
  await shot("mfa-desktop-mocked.png");
  await call("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: true }); await evaluate("window.scrollTo(0,0)");
  assert.equal(await evaluate("document.documentElement.scrollWidth <= 390"), true); await shot("mfa-mobile-mocked.png");
  report.cases.push("MFA UI: mocked transaction polling SUCCESS; mobile no overflow");
  await call("Emulation.setDeviceMetricsOverride", { width: 1440, height: 1100, deviceScaleFactor: 1, mobile: false });
  await navigate("http://localhost:3000/api-test/primary");
  await evaluate("(()=>{const banner=document.createElement('div');banner.textContent='LOCAL MOCK TEST · ไม่ได้ส่ง Push / TOTP verification จริง';banner.style='position:fixed;top:0;left:0;right:0;z-index:99999;padding:5px;text-align:center;background:#fff2cc;color:#75530a;font-size:12px';document.body.append(banner)})()");
  await until("Boolean(document.querySelector('#demo-confirm-pair'))");
  assert.equal(await evaluate("document.querySelector('#demo-save-primary').disabled"), true);
  assert.equal(primaryCalls, 0, "No automatic push on page load");
  await evaluate("document.querySelector('#demo-confirm-pair').click()");
  await until("!document.querySelector('#demo-save-primary').disabled");
  await evaluate("document.querySelector('#demo-save-primary').click()");
  await until("!document.querySelector('#demo-send-push').disabled");
  report.cases.push("Primary demo: pairing requires explicit confirmation; no automatic MFA");
  await evaluate("document.querySelector('#demo-send-push').click()");
  await until("document.querySelector('[data-testid=primary-challenge]')?.textContent === '42'");
  await evaluate("document.querySelector('.primary-demo-cards').scrollIntoView({block:'start'})");
  await shot("primary-demo-push-waiting-mocked.png");
  await until("document.querySelector('[data-testid=push-result]').classList.contains('result-success')");
  await evaluate("document.querySelector('[data-testid=push-trace]').open=true");
  assert.equal(await evaluate("document.querySelector('[data-testid=push-trace]').innerText.includes('fixturePushDevice2')"), true);
  report.cases.push("Primary demo: mocked push targets saved Primary, number challenge, polling SUCCESS and REST trace");
  await evaluate("(()=>{const input=document.querySelector('#demo-totp-code');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,'654321');input.dispatchEvent(new Event('input',{bubbles:true}))})()");
  await until("!document.querySelector('#demo-verify-totp').disabled");
  await evaluate("document.querySelector('#demo-totp-code').dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}))");
  await until("document.querySelector('[data-testid=totp-result]').classList.contains('result-success')");
  await evaluate("document.querySelector('[data-testid=totp-trace]').open=true");
  assert.equal(await evaluate("document.querySelector('#demo-totp-code').value"), "");
  assert.equal(await evaluate("document.querySelector('[data-testid=totp-trace]').innerText.includes('654321')"), false);
  assert.equal(await evaluate("document.querySelector('[data-testid=totp-trace]').innerText.includes('[REDACTED]')"), true);
  await shot("primary-demo-success-mocked.png");
  report.cases.push("Primary demo: mocked TOTP SUCCESS; passcode cleared and redacted from REST trace");
  assert.equal(await evaluate("[...document.querySelectorAll('a[href=\"/api-test/primary/source\"]')].every(a=>a.target === '_blank')"), true);
  await call("Browser.setDownloadBehavior", { behavior: "deny" });
  const exportedText = await evaluate("(async()=>{const original=URL.createObjectURL;URL.createObjectURL=blob=>{window.__demoReport=blob.text();return original.call(URL,blob)};[...document.querySelectorAll('button')].find(b=>b.textContent.includes('ดาวน์โหลดผล JSON')).click();const text=await window.__demoReport;URL.createObjectURL=original;return text})()");
  const exported = JSON.parse(exportedText);
  assert.equal(exported.results.push.state, "SUCCESS"); assert.equal(exported.results.totp.state, "SUCCESS");
  assert.equal(exportedText.includes("654321"), false); assert.equal(exportedText.includes(env.OKTA_API_TOKEN), false);
  report.cases.push("Primary demo: JSON export retains both mocked results without OTP/API token; source opens a new tab");
  await evaluate("(()=>{const input=document.querySelector('#demo-totp-code');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,'000000');input.dispatchEvent(new Event('input',{bubbles:true}))})()");
  await until("!document.querySelector('#demo-verify-totp').disabled");
  await evaluate("document.querySelector('#demo-verify-totp').click()");
  await until("document.querySelector('[data-testid=totp-result]').classList.contains('result-error')");
  report.cases.push("Primary demo: invalid mocked TOTP replaces previous success with ERROR");
  pollOutcome = "REJECTED";
  await evaluate("document.querySelector('#demo-send-push').click()");
  await until("document.querySelector('[data-testid=push-result]').classList.contains('result-rejected')");
  report.cases.push("Primary demo: mocked push rejection never displays success");
  pollOutcome = "SUCCESS";
  await evaluate("document.querySelector('#demo-send-push').click()");
  await until("Boolean(document.querySelector('[data-testid=primary-challenge]'))");
  await evaluate("[...document.querySelectorAll('button')].find(b=>b.textContent.includes('หยุดรอผล')).click()");
  await pause(3000);
  assert.equal(await evaluate("document.querySelector('[data-testid=push-result]').classList.contains('result-stopped')"), true);
  report.cases.push("Primary demo: stop polling does not become SUCCESS or pretend to cancel Okta");
  await call("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await evaluate("window.scrollTo(0,0)");
  assert.equal(await evaluate("document.documentElement.scrollWidth <= 390"), true);
  await shot("primary-demo-mobile-mocked.png"); report.cases.push("Primary demo: 390px viewport no horizontal overflow");
  await navigate("http://localhost:3000/api-test/primary/source");
  await until("document.querySelectorAll('.demo-source').length === 4");
  assert.equal(await evaluate("document.querySelector('.demo-source pre').textContent.includes('poc_mfa_preferences')"), true);
  assert.equal(await evaluate("document.documentElement.scrollWidth <= 390"), true);
  report.cases.push("Primary demo: real allowlisted source renders and stays within mobile viewport");
  await call("Fetch.disable");
  if (process.argv.includes("--hosted")) {
    await call("Emulation.setDeviceMetricsOverride", { width: 1440, height: 1000, deviceScaleFactor: 2, mobile: false });
    await navigate("http://localhost:3000/api/oidc/login");
    await until("location.hostname === 'trial-3224781.okta.com' && document.readyState === 'complete'");
    await pause(1800);
    const branding = await evaluate("({logo:[...document.images].some(i=>i.currentSrc.includes('fs018wud3cvagXZDe698')),background:[...document.querySelectorAll('body,body *')].some(e=>getComputedStyle(e).backgroundImage.includes('fs018wufsfjYK8E5k698'))})");
    assert.equal(branding.logo, true, "Hosted Okta logo"); assert.equal(branding.background, true, "Hosted Okta background");
    await shot("okta-hosted-branding-no-login.png"); report.cases.push("Real hosted Okta sign-in renders configured logo/background (no credentials entered, not a login test)");
  }
  await writeFile(join(output, "report.json"), JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify(report, null, 2)); console.log("Screenshots: " + output);
} finally { socket?.close(); chrome.kill("SIGTERM"); }
