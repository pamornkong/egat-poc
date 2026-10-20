# งานค้างก่อนสรุปผล POC — 20 ต.ค. 2026

อ้างอิง WikiKai #1482 และ TOR หมวด 3/4/5 ใน #1483 รายการด้านล่างแยก implementation, local fixture test, config/API verification และการสาธิตจริงออกจากกัน ยังไม่รับรองว่า TOR ผ่านครบ

## สิ่งที่ทำเพิ่ม

- `/api-test` เป็น MFA Lab: โหลด test user/factor catalog/enrolled factors, enrollment QR, TOTP activation, Push Number Matching + transaction polling, TOTP verification
- ตั้ง `OKTA_MFA_CONSOLE_USER_IDS` เป็น pamornko และ tharayuth; API token ใช้เฉพาะ server, หา Okta user จาก session และอนุญาตเฉพาะ user ใน allowlist ให้จัดการ MFA ของตัวเองเท่านั้น; mutation ตรวจ Origin/JSON และ allowlist factor types; ไม่รับ URL ให้ส่ง SSWS ตาม arbitrary link
- Primary Push และการจับคู่ TOTP ของอุปกรณ์ Primary เก็บใน PostgreSQL เจ้าของต้องยืนยันว่า TOTP มาจากเครื่องเดียวกัน ไม่เดาการจับคู่จากชื่อบัญชี และไม่อ้างว่าเปลี่ยน Primary ของ Hosted Sign-In
- PostgreSQL ผ่าน `pg` ไม่มี ORM; ตาราง `poc_mfa_preferences` และ `poc_auth_evidence`; queries ที่รับค่าผู้ใช้ใช้ parameters
- `/evidence` และ `/api/evidence` แสดง/export เฉพาะบัญชีปัจจุบัน บันทึกหลัง callback ตรวจผ่าน เก็บ normalized profile, เวลา, protocol, validation description, SHA-256 ไม่เก็บ token/assertion เต็ม; unique digest ป้องกัน replay ของ response เดิม
- SAML บังคับ signed assertion เพิ่ม audience/destination/required-expiry checks; OIDC จำกัด RS256 และ required claims
- Mobile แก้ hook/redirect, เพิ่ม token validation API, Account, SecureStore restore/expiry, app locking, Biometrics/device-passcode fallback, Logout
- Mobile token access policy และ mobile-only Push/FastPass UV policy สร้างและอ่านกลับแล้ว; Web/SAML policy ไม่เปลี่ยน
- Hosted Sign-In: อัปโหลด Logo EGAT-POC และ Background, ตั้งสีเขียวจริงที่ Okta; Chrome เห็น assets บนหน้า Okta แล้ว
- Hosted hyperlink: API ตอบ **403 `Cannot update page content for the default brand.`** ต้องเลือก brand/custom-domain ที่รองรับหรือให้ผู้ดูแลจัดการต่อ ไม่แก้ recovery URL เป็นทางลัด
- Docker Web/DB bind เฉพาะ `127.0.0.1` สำหรับ dev local ไม่มี production build

## ผลตรวจอัตโนมัติ

| รายการ | ผลและขอบเขต |
|---|---|
| Web / Mobile TypeScript | ผ่าน `tsc --noEmit` |
| API smoke | 21 checks ผ่าน; read-only Okta catalog/user/factors, session/owner/CSRF/JSON guards, DB preferences read, evidence export และ invalid mobile token; ใช้ **local signed session fixtures** ไม่ใช่ Login จริง |
| Browser | เมนู Account OIDC/SAML กดเปิดด้วย pointer และปิดด้วย Space; custom claims render; viewport 390px ไม่ล้น |
| MFA UI | mock Primary selection, Number Matching 42 และ polling SUCCESS; ไม่ส่ง Push, enroll หรือเปลี่ยน Primary จริง |
| Hosted branding | เบราว์เซอร์เปิดหน้า Okta จริง เห็น Logo/Background ที่ตั้งไว้ ไม่กรอกรหัสผ่านและไม่ได้ Login |
| Mobile Metro | Android Hermes bundle export ผ่าน ไม่ใช่ผลรันบน hardware |
| Android emulator | Expo เริ่ม AVD แล้ว timeout; ไม่มีอุปกรณ์ ADB พร้อมใช้งาน |
| Android APK | Gradle `:app:assembleDebug` สำเร็จ (443 tasks); ได้ `mobile/android/app/build/outputs/apk/debug/app-debug.apk` สำหรับ arm64-v8a, debug development build ไม่ใช่ production; ยังไม่ได้ติดตั้ง/เปิดบนอุปกรณ์ |

ผล browser และภาพอยู่ `docs/evidence/browser-local/` โดยไฟล์ชื่อ fixture/mocked ไม่ใช่ผลยืนยันตัวตนจริง ใช้ `node scripts/browser-check.mjs --hosted` ตรวจซ้ำ และ `node scripts/verify-api.mjs` ตรวจ HTTP ไม่มีการส่ง MFA จริงจากสองสคริปต์นี้

## เกณฑ์ที่ยังต้องสาธิตจริง

| TOR | ความพร้อม / หลักฐานที่ยังขาด |
|---|---|
| 3.1 | OIDC + custom claims มีโค้ด; Login สองบัญชีและ export `/api/evidence` หลัง callback จริง |
| 3.2 | Enrollment policy บังคับ Verify อยู่แล้ว; tharayuth ต้อง Activate/ตั้ง password/ลงทะเบียนเอง เก็บ first-time flow |
| 3.3 | Policy Number Challenge ALWAYS; ส่ง Push ให้ผู้ใช้อนุมัติจริงและเทียบ System Log |
| 3.4 | UI เลือก Primary พร้อมแล้ว; ต้องลงทะเบียน ≥2 อุปกรณ์ของผู้ใช้เดียวกันและพิสูจน์ Push ได้ทั้งคู่; app-selected Primary ต้องยืนยันการยอมรับตาม TOR |
| 3.5 | ส่ง Push ระบุ Primary factorId ได้; ยังรอผลอนุมัติ/ปฏิเสธ/timeout จริง |
| 3.6 | จับคู่ TOTP ของ Primary และ verify passCode ได้; ต้องยืนยันเครื่องเดียวกันและทดสอบรหัสจริง/รหัสผิด |
| 3.7 | Web token exchange ใช้ Client Secret + PKCE ฝั่ง server; เก็บ source + ผล Login จริง ไม่เผย secret |
| 4.1 | SAML validation/profile/evidence พร้อม; เก็บ Signed Response ที่ปกปิดข้อมูลและ dashboard สองบัญชีจริง |
| 4.2 | Password + Push/Number Challenge policy คงเดิม; สาธิตและตรวจ System Log |
| 4.3 | Logo EGAT-POC แสดงบน Okta แล้ว; **ยังไม่ใช่ Logo กฟผ. ที่ได้รับอนุมัติ** ต้องรับ asset ทางการก่อนสรุปตามถ้อยคำ TOR |
| 4.4 | Background บน Okta จริงตรวจด้วย browser แล้ว; รอผู้รับรองเลือก/อนุมัติภาพสำหรับเดโม |
| 4.5 | Hyperlink ติด 403 บน default brand ต้อง config brand/domain ที่อนุญาต |
| 5.1 | React Native OIDC implementation + typecheck/Metro ผ่าน; Android/iOS callback จริงยังไม่ทดสอบ |
| 5.2 | Local unlock ไม่ใช่ Okta Passwordless; FastPass UV เป็นทางเลือกที่ตั้งเพิ่ม ยังไม่พิสูจน์ PIN/Bio → Push + Number Matching ตามลำดับ TOR ต้องยืนยัน product/license/วิธีเดโม equivalent |
| 5.3 | AuthSession Code+S256 PKCE พร้อม; เก็บ trace ปกปิด verifier/code/token และผล native callback จริง |

Login/Logout จริงหลังแก้ Trusted Origin ยังรอเจ้าของบัญชีทำ MFA ใน browser ตรวจว่า OIDC และ SAML จบ Okta session และกลับหน้าแรกจริง; SAML logout ปัจจุบันเป็น Org Sign-Out ไม่ใช่ SAML SLO

## สิ่งที่ต้องได้รับจากเจ้าของงาน

1. เจ้าของทั้งสองบัญชี Login/Activation/ตั้งรหัสผ่าน/อนุมัติ Okta Verify ด้วยตัวเอง (tharayuth ยัง PROVISIONED ณ รอบ audit)
2. มือถืออย่างน้อยสองเครื่องสำหรับผู้ใช้เดียวกัน และ Android/iOS ที่รัน development build ได้
3. Logo กฟผ. ทางการ + หน้าเป้าหมายของ hyperlink + custom brand/domain ถ้าจำเป็น
4. ยืนยัน license/feature กับ Okta และยอมรับวิธี Primary/FastPass เทียบข้อความ TOR; API config ไม่ใช่หลักฐาน entitlement

## ความปลอดภัยและข้อจำกัด

`npm audit` พบ Web Next.js 14 และ transitive PostCSS มี advisory ระดับ critical/high; Mobile Expo 51 มี dependencies เก่าหลายรายการ ยังไม่ได้ทำ major framework/SDK migration ในงานนี้ อย่าเปิดสู่ internet หรือใช้ production ต้องวางแผนอัปเกรดและ retest auth/native compatibility ก่อน แม้บาง advisory จะขึ้นกับ feature/OS ที่ใช้งาน

Secrets เดิมอยู่ใน `.env.local` ที่ ignore และไม่ส่งขึ้นเอกสาร หากเคยแชร์ credentials ผ่านช่องทางแชต ให้หมุน Client Secret/API Token ก่อนใช้กับข้อมูลจริง โดยประสานการเปลี่ยนค่าเพื่อไม่ให้เดโมหยุด

## แบบบันทึกเมื่อสาธิตจริง

แต่ละกรณีระบุ TOR, บัญชี, OS/อุปกรณ์, เวลา Asia/Bangkok, expected/actual, evidence ID/System Log correlation, ผลผ่าน/ไม่ผ่าน และผู้รับรอง ห้ามใช้ผล fixture/mock หรือ Token Preview เป็นผลผ่าน TOR

## ผล Android debug build รอบสุดท้าย

รอบแรก resource linking พบ `splashscreen_background` หาย แก้สีใน Android resources และระบุ splash background ใน Expo config แล้ว รอบสอง `BUILD SUCCESSFUL in 3m 38s`, 443 actionable tasks. APK ประมาณ 134 MB สำหรับ development client ต้องรัน Metro และเชื่อมอุปกรณ์ก่อนใช้งาน ผล build นี้ไม่ใช่ผล Login/MFA/biometric runtime. ไม่มีการ build Web production image.

`aapt` ยืนยัน package `th.egat.sso.poc`, label EGAT-POC, minSdk 23 / targetSdk 34 และ Biometrics permission; `apksigner verify` exit 0 (มี warnings ของ META-INF entries ใน debug APK). SHA-256: `3de2638ae6a0eb22a3fa664b03f98d12278b7eace5f3e7b9f055876c82e59dba`. Gradle เลือก compile native target arm64-v8a; ยังไม่รับรอง runtime ของ ABI อื่นแม้ dependencies บางตัวมี libraries หลาย ABI ใน APK.
