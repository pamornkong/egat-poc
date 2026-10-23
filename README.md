# EGAT SSO POC — Docker + Okta

POC นี้ครอบคลุม Web OIDC + API, Web SAML SSO และ Mobile OIDC + PKCE

## Stack / Tools

- Web: Next.js 14, React 18, Node.js 20, `jose`, `samlify`, `@authenio/samlify-node-xmllint`, `ws`, `pg` / `@types/pg`
- Mobile: Expo 51, React Native 0.74, `expo-auth-session`, `expo-secure-store`, `expo-local-authentication`, `expo-crypto`, `expo-web-browser`, `expo-dev-client`
- Identity/MFA: Okta Trial สำหรับ POC; OneLogin เป็นระบบเป้าหมายตามเอกสาร TOR
- API: Okta Management REST API สำหรับ factor catalog, enroll, activate และ verify
- Database: PostgreSQL 16 Alpine ผ่าน Docker Compose และ volume `postgres_data`
- Database client: `pg` ไม่มี ORM; เก็บ Primary Push/TOTP preference และหลักฐาน callback ที่ตรวจผ่าน (ไม่เก็บ token/assertion เต็ม)
- Typography: Manrope สำหรับอังกฤษ/ตัวเลข + Anuphan สำหรับไทย เป็น variable WOFF2 ที่เก็บใน `web/app/fonts` และโหลดผ่าน `next/font/local`; ไม่เพิ่ม npm dependency หรือเรียก Google Fonts ตอนเปิดเว็บ ดูแหล่งที่มาและ license ในโฟลเดอร์ฟอนต์

## รัน Web แบบ Dev Local ด้วย Docker

    docker compose up -d

Web จะรันด้วย Next.js development server และ mount source จากโฟลเดอร์ `web` ดังนั้นแก้ไฟล์แล้วหน้าเว็บจะ hot reload โดยไม่ต้อง build image ส่วน PostgreSQL 16 จะรันพร้อม persistent volume `postgres_data` เปิด http://localhost:3000 และตรวจ health ได้ที่ http://localhost:3000/api/health

PostgreSQL อยู่ที่ `db:5432` จาก Web container และ `localhost:55432` จากเครื่อง host โดยค่า connection อยู่ใน `DATABASE_URL` ของ `.env.local` (เพื่อไม่ชนกับ PostgreSQL ของ project อื่นที่ใช้ port 5432) ทั้ง Web/DB bind เฉพาะ `127.0.0.1` สำหรับ dev local; health endpoint ตรวจ PostgreSQL และ schema ด้วย

## Okta callback URLs

    OIDC Web sign-in: http://localhost:3000/api/oidc/callback
    OIDC Web sign-out: http://localhost:3000
    SAML ACS: http://localhost:3000/api/saml/callback

ตั้งค่า callback URLs ใน Okta ให้ตรงกับด้านบนก่อนทดสอบ

หน้า `/success` แสดงชื่อ อีเมล รหัสพนักงาน (`employee_code`) และแผนก (`department`) ใน Account ทั้ง OIDC และ SAML โดย OIDC อ่านค่าจาก ID token ที่ตรวจสอบแล้วและขอ scope `openid profile email`; Claims สองรายการใน Okta ตั้งเป็น ID Token / Always และผูกกับ scope `profile` ส่วน SAML อ่าน Attributes หลังตรวจ SAML response ผ่านแล้ว โดยไม่ต้องขอ OAuth scope

หลังเข้าสู่ระบบ กดเมนู Account มุมขวาบนของหน้าแรกหรือ dashboard เพื่อดูชื่อ บัญชีผู้ใช้ อีเมล รหัสพนักงาน แผนก และวิธีเข้าสู่ระบบได้ พร้อมลิงก์ไปข้อมูลบัญชีที่ `/success#account` และ Logout บัญชีผู้ใช้ของ OIDC อ่านจาก `preferred_username` (ถ้าไม่มีใช้ email/sub) ส่วน SAML อ่านจาก NameID จึงแสดงบัญชีผู้ใช้แยกจากอีเมลได้ เมนูใช้ HTML details/summary ไม่เพิ่ม dependencies

SAML Profile mappings ที่ตรวจยืนยันผ่าน API แล้ว:

| Attribute | Okta Expression |
| --- | --- |
| `email` | `user.profile.email` |
| `name` | `user.profile.firstName + " " + user.profile.lastName` |
| `given_name` | `user.profile.firstName` |
| `family_name` | `user.profile.lastName` |
| `employee_code` | `user.profile.egatEmployeeCode` |
| `department` | `user.profile.egatDepartment` |

SAML callback เก็บโปรไฟล์เป็น fields กลางใน session พร้อม Attributes เดิม โดย dashboard อ่านได้ทั้ง session SAML เดิมที่มีเฉพาะ Attributes และ session ใหม่ รองรับ Attribute แบบ string หรือ array ที่มีค่าเดียว หากไม่มี email จะใช้ NameID เป็น email เฉพาะเมื่อมีรูปแบบอีเมลเท่านั้น ส่วนข้อมูลที่หายจะแสดง “ยังไม่ได้รับข้อมูล” หลังแก้ mapping/profile ใน Okta ให้ Logout แล้ว Login ใหม่เพื่อรับข้อมูลล่าสุด ใช้ dependencies เดิม ไม่ต้อง build image ใหม่

หาก Okta แจ้งว่าไม่ได้รับอนุญาตให้เข้าแอป ให้ตรวจทั้ง app sign-in policy และ Access Policy ของ Authorization Server เมื่อ 20 ตุลาคม 2026 พบ `no_matching_policy` เพราะ `default` ไม่มี Access Policy จึงเพิ่ม Policy เฉพาะ Web OIDC สำหรับ `authorization_code` และ scopes `openid profile email` แล้ว โดยคง Password + Okta Verify Push ไว้ ดู [หลักฐาน การตั้งค่า และวิธีทดสอบ](docs/OKTA_OIDC_TROUBLESHOOTING.md)

## Logout กลับหน้าแรก

ปุ่ม Logout ล้าง session ของเว็บและส่ง browser ไปจบ Okta session โดย OIDC ใช้ `/oauth2/default/v1/logout` พร้อม `id_token_hint` และ `post_logout_redirect_uri` ส่วน session SAML ใช้ `/login/signout?fromURI=http%3A%2F%2Flocalhost%3A3000` เพื่อกลับหน้าแรกโดยตรง ไม่ใช้ ACS callback ของการ login และยังไม่ได้ใช้ SAML Single Logout protocol

แก้ปัญหา SAML logout สำเร็จแต่ค้างที่หน้า Okta ด้วยการเพิ่ม Trusted Origin `EGAT-POC Local Web Redirect` (`tos18w9xs3x0Y4mXT698`) ที่ `http://localhost:3000` สถานะ ACTIVE และ scope REDIRECT เท่านั้น โดย OIDC app มี Sign-out URI `http://localhost:3000` ลงทะเบียนไว้แล้ว ไม่ได้เพิ่ม CORS หรือเปลี่ยน sign-out page ส่วนกลางของทั้งองค์กร อ่านค่ากลับผ่าน API แล้วยืนยันเรียบร้อย ส่วน logout ครบ flow กับ Okta session จริงต้องทดสอบผ่าน browser

หากยังไม่กลับ ให้เริ่ม SAML login ใหม่แล้ว Logout อีกครั้ง และตรวจ `Security → API → Trusted Origins` ว่า origin ตรงทั้ง protocol/host/port (เช่น `127.0.0.1` กับ `localhost` เป็นคนละ origin) การแก้ config ครั้งนี้ไม่ต้อง rebuild หรือ restart container

อ้างอิง: [Okta: Troubleshooting logout redirects using fromURI](https://support.okta.com/help/s/article/troubleshooting-okta-logout-redirects-using-the-fromuri-parameter?language=en_US)

## หน้าแจ้งข้อผิดพลาด

OIDC / SAML ที่ทำรายการไม่สำเร็จจะกลับมาที่ `/auth/error` พร้อมข้อความภาษาไทย ปุ่มลองใหม่ และรหัสอ้างอิงสำหรับค้นใน log (`docker compose logs -f web`) แทนการแสดง JSON หรือรายละเอียดจากผู้ให้บริการโดยตรง โดยยังตรวจ OIDC state ก่อนประมวลผลผลตอบกลับที่เป็น error

ดูตัวอย่างได้ที่ http://localhost:3000/auth/error?code=access_denied&protocol=oidc และ http://localhost:3000/auth/error?code=saml_failed&protocol=saml ส่วนหน้าไม่พบข้อมูลและข้อผิดพลาดระหว่างแสดงผลใช้ดีไซน์เดียวกัน หน้า `/success` จะตรวจ session ก่อนแสดง dashboard

ขอบเขตนี้ครอบคลุมข้อผิดพลาดที่กลับมาถึงเว็บ หาก Okta แสดง error บนโดเมนของ Okta โดยไม่ redirect กลับ ต้องตรวจการตั้งค่าที่ Okta ด้วย

ใช้ Next.js / React และ CSS ที่มีอยู่แล้ว ไม่เพิ่ม dependency และไม่ต้อง build image ใหม่

## รัน Mobile

    cd mobile
    npm install
    npm run android

Mobile ใช้ native development build ไม่ใช่ Expo Go; ต้องมี emulator/device และ Android SDK/Xcode ตามแพลตฟอร์ม ไม่ได้รันใน Web container ดู [คู่มือ Mobile / PIN / FastPass และข้อจำกัด TOR](docs/MOBILE_DEMO.md)

## API / MFA

สำหรับสาธิตเฉพาะ TOR 3.5 / 3.6 เปิด **http://localhost:3000/api-test/primary**: บันทึก Primary/จับคู่ TOTP ครั้งเดียว แล้วกดส่ง Push หรือกรอกรหัส TOTP แยกสองการ์ด มี Number Matching/polling, request/response ที่ปกปิดรหัส, เปิด Source จริง และดาวน์โหลดผล JSON ดู [คู่มือเดโมสองข้อ](docs/PRIMARY_MFA_DEMO.md). TOTP เป็นการตรวจรหัสที่มือถือสร้าง ไม่ใช่ส่ง OTP ไปมือถือ.

กำหนด `OKTA_MFA_CONSOLE_USER_IDS` เป็น Okta user ID ที่อนุญาต (คั่นด้วย comma; ปัจจุบัน pamornko และ tharayuth) แล้ว Login ด้วยบัญชีของตนและเปิด http://localhost:3000/api-test เพื่อใช้ MFA Lab: enrollment QR, activation TOTP, Push Number Matching/polling, TOTP และ Primary Push/TOTP preference API หา Okta user จาก session (OIDC `sub` / SAML NameID) ไม่รับ userId จาก caller ผู้ใช้ใน allowlist แต่ละคนจึงจัดการได้เฉพาะ MFA ของตัวเอง API token ถูกใช้เฉพาะ server-side route และไม่ส่งไป mobile/browser

MFA API routes:

    GET  /api/okta/factors
    GET  /api/okta/test-user
    GET  /api/okta/test-user/factors
    POST /api/okta/test-user/factors
    POST /api/okta/test-user/factors/:factorId/activate
    POST /api/okta/test-user/factors/:factorId/verify
    GET  /api/okta/test-user/factors/:factorId/transactions/:transactionId
    POST /api/okta/test-user/primary

POST ตรวจ Origin, JSON และ allowlist factor types/passCode ไม่ส่ง body ใด ๆ ต่อโดยไม่ตรวจ Push verification ส่ง `useNumberMatchingChallenge: true`; ไม่สร้างหมายเลข challenge จำลองขึ้นในแอป การส่ง Push/Enrollment ต้องกดเองโดยเจ้าของบัญชี

Primary เป็น preference ของ POC ใน PostgreSQL ไม่เปลี่ยน default device ของ Okta Hosted Sign-In หากจับคู่ TOTP ต้องยืนยันว่าเป็นอุปกรณ์เดียวกับ Push จริง

## หลักฐาน / สถานะ POC

เปิด `/evidence` หลัง Login รอบใหม่เพื่อดูข้อมูลจาก callback ที่ตรวจผ่านของบัญชีตัวเอง และ `/api/evidence` เพื่อ export JSON ที่ไม่มี token/assertion เต็ม เก็บ protocol/profile/เวลา/validation method/SHA-256; SAML มีการตรวจ signed assertion, audience, destination, required expiry และ unique response digest

ผลตรวจและเกณฑ์ที่ยังรอเจ้าของบัญชี/อุปกรณ์/สิทธิ์อยู่ใน [POC Acceptance](docs/POC_ACCEPTANCE.md) ภาพ browser ใน `docs/evidence/browser-local` ระบุ fixture/mocked ชัดเจน ไม่ใช่หลักฐานว่า Login/MFA จริงผ่านแล้ว

    node scripts/verify-api.mjs
    node scripts/browser-check.mjs --hosted
    docker compose exec web npm run typecheck

Hosted Okta ใช้ Logo/Background/สี EGAT-POC แล้ว ตรวจหน้าจอจริงโดยไม่ Login; hyperlink API ติดข้อจำกัด default brand 403 และ Logo ยังไม่ใช่ asset กฟผ. ทางการ สคริปต์ `configure-branding.mjs` และ `configure-mobile-policy.mjs` เป็น dry-run ตามปกติ ใส่ `--apply` เฉพาะเมื่อตั้งใจเปลี่ยน configuration

`npm audit` ยังพบ advisory ใน Next.js 14/PostCSS และ Expo 51 เดิม ไม่ใช้ POC นี้เป็น production/เปิด internet ก่อนอัปเกรดและทดสอบใหม่ ไม่มีการ major-upgrade framework หรือ build production image ในรอบนี้

## ตรวจ config

    node scripts/verify-config.mjs

ค่า secret อยู่ใน .env.local และไฟล์นี้ถูก ignore แล้ว
