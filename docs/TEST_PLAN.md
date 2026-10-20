# EGAT SSO POC Test Plan

## Web OIDC

- [x] ตรวจพบ `no_matching_policy` และเพิ่ม Authorization Server Access Policy เฉพาะ Web OIDC
- [x] อ่านค่ากลับผ่าน API ยืนยัน Policy/Rule ACTIVE และ client/grant/scopes ตรงกับคำขอของเว็บ
- [x] ยืนยัน app sign-in policy ยังคง Password + Okta Verify Push (2FA)
- [ ] Redirect ไป Okta และกลับ callback ด้วย state/nonce
- [ ] Authorization Code + PKCE แลก token สำเร็จ
- [ ] ตรวจลายเซ็น ID token ด้วย JWKS
- [ ] แสดง email/sub จาก claims
- [x] แสดง employee_code และ department ใน Account โดยตรวจด้วย local session fixture ผ่าน HTTP (ไม่ใช่ผล login จริงที่ Okta)
- [x] ตรวจค่าที่เปลี่ยนไป, ค่าที่หาย/ว่าง/ผิดชนิด และการ escape ข้อความของ Custom Claims
- [ ] ยืนยัน employee_code และ department จาก ID token หลัง login จริงด้วย scope profile
- [ ] Logout ล้าง session

## Web SAML

- [x] อ่าน mapping ผ่าน Federated Claims API ยืนยัน email/name/given_name/family_name/employee_code/department
- [x] ทดสอบ local profile normalization สำหรับ Attributes แบบ string และ array ค่าเดียว
- [x] ทดสอบ dashboard ผ่าน HTTP ด้วย local session fixtures ทั้ง session SAML เดิม, session ใหม่ และ OIDC
- [x] ทดสอบ NameID ที่เป็นอีเมล/opaque ID, Attributes หาย/ผิดชนิด และการ escape ข้อความ
- [x] ยืนยันใช้เฉพาะ profile fields ที่กำหนดไว้ ไม่ให้ Attributes เขียนทับ protocol/sub หรือ token
- [ ] ยืนยันชื่อ อีเมล รหัสพนักงาน และแผนกจาก SAML assertion หลัง login จริง
- [ ] SP-initiated login redirect ไป Okta
- [ ] ACS รับ HTTP-POST SAMLResponse
- [ ] ตรวจ signature/issuer/audience ของ assertion
- [ ] อ่าน Custom Attribute
- [ ] ทดสอบ Logo/Background/Hyperlink ของ Login Page

## Account menu (ตรวจด้วย local session fixtures ผ่าน HTTP)

- [x] หน้าแรกและ dashboard แสดง Account menu ทั้ง OIDC และ SAML หลังเข้าสู่ระบบ
- [x] แสดงบัญชีผู้ใช้แยกจากอีเมลเมื่อ preferred_username/NameID ไม่ใช่อีเมลเดียวกัน
- [x] เมนูมีชื่อ อีเมล รหัสพนักงาน แผนก ลิงก์ข้อมูลบัญชี และ Logout
- [x] ไม่ส่ง id_token/access_token มาในข้อมูลที่แสดงในเมนูหรือหน้าเว็บ
- [x] หน้าแรกที่ไม่มี session ไม่แสดงเมนูบัญชี และ dashboard ยังปฏิเสธการเข้าโดยไม่มี session
- [x] Chrome local fixtures: pointer เปิด / Space ปิด Account OIDC/SAML, จอ 390px ไม่ล้น; ภาพ/ผลใน `docs/evidence/browser-local` (ไม่ใช่ Login จริง)

## Error handling (ตรวจผ่าน HTTP บน local dev)

- [x] เปิด OIDC callback ตรง ๆ ได้หน้าแจ้งลิงก์ไม่สมบูรณ์
- [x] OIDC state หาย/ไม่ตรง และ PKCE cookies หาย ต้องเริ่ม login ใหม่
- [x] ผลปฏิเสธจาก provider ต้องตรวจ state ก่อนแสดง error
- [x] แยก access_denied, interaction_required, invalid_client และ temporarily_unavailable
- [x] Provider error ที่ไม่รู้จักใช้ข้อความทั่วไป ไม่ส่ง error_description ต่อใน URL ใหม่
- [x] SAML callback ผ่าน GET, form ไม่ถูกต้อง หรือไม่มี SAMLResponse แสดงหน้าช่วยเหลือ
- [x] SAML assertion ที่ไม่ถูกต้องไม่สร้าง session และ redirect แบบ 303
- [x] หน้า error มีปุ่มลองใหม่ตาม protocol และกลับหน้าแรก
- [x] Error code/protocol ที่ไม่รู้จักใช้ค่าที่กำหนดไว้ ไม่ใช้เป็น URL ภายนอก
- [x] ไม่มี session แล้วเปิด /success ต้องไม่เห็นสถานะ Verified
- [x] หน้าที่ไม่มีอยู่ตอบ HTTP 404 ด้วยดีไซน์ของแอป
- [x] Logout ล้าง session และ cookies ของ OIDC พร้อมส่งไป Okta โดยระบุหน้าแรกสำหรับกลับมา
- [x] เพิ่มและอ่านค่ากลับยืนยัน Trusted Origin http://localhost:3000 เป็น ACTIVE พร้อม REDIRECT scope สำหรับ Org Sign-Out ของ SAML
- [x] OIDC login ยังคงส่ง redirect URI และ PKCE ตามเดิม
- [ ] ทดสอบ login สำเร็จครบ flow ด้วยบัญชีจริงหลังปรับ error handling
- [ ] ทดสอบ logout ครบ flow ในเบราว์เซอร์ที่มี Okta session

## MFA / API

- [x] List factor catalog ผ่าน `/users/:id/factors/catalog` ด้วย local signed-session fixture + Okta read-only API
- [x] Get test user ด้วย local fixture + Okta read-only API
- [x] List enrolled factors + อ่าน Primary preference จาก PostgreSQL
- [ ] Enroll factor ตาม policy ของ tenant
- [ ] Activate factor ด้วย passCode ถ้า factor ต้องยืนยัน
- [ ] Push/TOTP verification
- [x] HTTP smoke: ไม่พบ API token/Client Secret ใน responses; server-only modules และ DTO จำกัดข้อมูลส่งกลับ
- [x] Unauthorized/เจ้าของผิดคน/Origin หาย/ข้ามโดเมน/JSON ผิด/factor type ผิด ถูกปฏิเสธ ไม่ส่ง MFA จริง
- [x] MFA UI mock: เลือก Primary, แสดง Number Matching ที่ได้รับ และ poll SUCCESS; ไม่ใช่หลักฐานอนุมัติจากอุปกรณ์
- [ ] ทดสอบ Primary Push + TOTP จากอุปกรณ์เดียวกันและสลับสองอุปกรณ์จริง

## Mobile OIDC

- [ ] เปิด Okta ผ่าน system browser
- [ ] Authorization Code + PKCE
- [ ] เก็บ token ใน SecureStore
- [ ] ทดสอบ PIN/Biometrics ของอุปกรณ์
- [ ] ทดสอบ redirect Android/iOS

## งานเพิ่มจาก WikiKai #1482

### หน้าเดโมเฉพาะ TOR 3.5 / 3.6

- [x] `/api-test/primary` แยกสองปุ่ม Push / TOTP, แสดง Primary และขอเจ้าของยืนยันการจับคู่ TOTP
- [x] `POST /api/okta/test-user/primary/verify` อ่าน destination จาก PostgreSQL ไม่ยอมรับ caller-selected factorId/userId
- [x] Source viewer fixed allowlist ของไฟล์จริง, JSON report / REST traces ปกปิด passCode/SSWS
- [x] Handler unit tests 13 กรณีผ่านด้วย mock Okta/PostgreSQL ไม่ส่ง MFA จริง; HTTP smoke เพิ่มเป็น 29 checks
- [x] Chrome local mocks: ยืนยัน pairing ก่อนบันทึก, Push challenge/poll/SUCCESS/REJECTED/หยุดรอ, TOTP ถูก/ผิด/ล้างรหัส, REST redaction, mobile 390px และ source allowlist แสดงได้
- [ ] สาธิต Push/TOTP จริงบน Primary พร้อมตรวจอุปกรณ์และ System Log (ไม่ใช้ผล fixture/mock รับรอง TOR)

รายละเอียด: `docs/PRIMARY_MFA_DEMO.md`; ใช้ `npm run verify:primary` ตรวจ handler เพิ่มจาก smoke/browser tests

### รายการเดิม

- [x] Web และ Mobile typecheck
- [x] Metro Android Hermes export (ไม่ใช่ native runtime)
- [x] แก้ Mobile hook ที่อยู่นอก component และ redirect ให้ตรง `com.egat.poc:/callback`
- [x] Mobile ID-token validation API จำกัด mobile audience/RS256/JWKS/issuer/expiry/nonce; invalid token ได้ 401
- [x] Mobile token access policy + mobile-only FastPass user-verification / Password+Push policy อ่านกลับถูกต้อง; Web/SAML คงเดิม
- [x] Hosted Okta Logo/Background/สี: API อ่านกลับ + Chrome หน้า Okta จริง โดยไม่ Login
- [ ] Hosted hyperlink: ติด default-brand 403; ต้องจัด brand/domain ที่อนุญาต
- [ ] Logo กฟผ. ทางการ (Logo ปัจจุบันเป็น EGAT-POC)
- [x] `/evidence` / JSON export จำกัดบัญชีปัจจุบัน ไม่มี token/assertion เต็ม; ไม่สร้างผล Login จำลองลง DB
- [x] Health check ตรวจ PostgreSQL/schema; Web/DB เปิดเฉพาะ loopback
- [x] Android debug APK: Gradle assembleDebug ผ่าน, arm64-v8a, ตรวจ package/signature; ยังไม่ใช่ผลเปิดแอปจริง
- [ ] Android native runtime และ iOS device E2E ดูผลล่าสุดใน `POC_ACCEPTANCE.md`
- [ ] TOR 5.2 PIN/Bio → Push+Number Matching: FastPass UV ทางเลือกและ local unlock ยังไม่ถือว่าพิสูจน์ลำดับนี้ครบ ต้องยืนยันการรองรับ/การยอมรับ equivalent

ตรวจซ้ำ: `node scripts/verify-api.mjs` (21 checks ไม่ส่ง MFA), `node scripts/browser-check.mjs --hosted` (local fixtures + หน้า hosted จริงโดยไม่ Login), `docker compose exec web npm run typecheck`, ใน mobile ใช้ `npm run typecheck` และ `npm run export:check`.
