# เดโม TOR 3.5 / 3.6 — Push และ TOTP ของ Primary

เปิด http://localhost:3000/api-test/primary หลัง Login ด้วยบัญชีที่กำหนดใน `OKTA_TEST_USER_ID` (ปัจจุบัน pamornko) มีลิงก์จากหน้าแรก, dashboard และ MFA Lab ไม่ต้องใช้ Postman หรือคัดลอก API Token

## เตรียมครั้งเดียว

1. เลือก Push factor ของอุปกรณ์ที่จะใช้เป็น Primary
2. เลือก TOTP factor ที่อยู่บน **อุปกรณ์เดียวกัน** และติ๊กยืนยันการจับคู่ แล้วกด **บันทึก Primary** ระบบไม่เดาการจับคู่ให้เจ้าของบัญชี หากยังไม่มี TOTP สามารถบันทึก Push เพื่อเดโมข้อ 5 ก่อนได้
3. ตรวจป้าย “พร้อมเดโมทั้ง 2 ข้อ”; หน้าจอแสดง factor IDs ที่บันทึก หากไม่พบอุปกรณ์ให้ไป MFA Lab เพื่อลงทะเบียนก่อน

การบันทึกนี้เป็น Primary preference ของแอป POC ใน PostgreSQL ไม่ได้เปลี่ยน default device ของ Okta Hosted Sign-In หากต้องการรับรองว่าเป็น Primary ตาม TOR ต้องให้ผู้ประเมินยอมรับวิธีนี้ด้วย

## ข้อ 5 — Push ผ่าน REST API (ผนวก 2 ข้อ 12.1)

1. กด **ส่ง Push ไป Primary** เพียงครั้งเดียว เป็นการส่งแจ้งเตือนไปอุปกรณ์จริง
2. เมื่อ Okta ส่ง Number Matching กลับ ให้เลือกหมายเลขเดียวกับที่หน้าเว็บแสดงบน Okta Verify
3. หน้าเว็บติดตาม transaction ทุก 2.5 วินาที และแสดงผล SUCCESS / REJECTED / TIMEOUT โดยไม่กดรีเฟรช
4. เปิด **REST request / response** เพื่อแสดง factorId ปลายทาง, upstream HTTP status, payload `{ "useNumberMatchingChallenge": true }`, หมายเลขที่ได้รับ และผล polling

ปุ่ม “หยุดรอผล” หยุด polling ในแอปเท่านั้น ไม่ยกเลิก Push ที่ส่งไปแล้ว และไม่แสดงว่าอนุมัติสำเร็จ คำขอที่ไม่ได้รับ transaction/poll result จะไม่ถือว่าผ่านจาก HTTP 201 อย่างเดียว

## ข้อ 6 — TOTP ผ่าน REST API (ผนวก 2 ข้อ 12.2)

1. เปิด Okta Verify บนเครื่อง Primary อ่านรหัส 6 หลักในช่วงเวลาปัจจุบัน
2. กรอกในช่อง **รหัส TOTP จากอุปกรณ์ Primary** แล้วกด **ตรวจ TOTP ผ่าน REST API**
3. แสดง SUCCESS จาก Okta จากนั้นลองรหัสผิดเพื่อแสดงกรณีปฏิเสธ ระบบจะไม่คงสถานะสำเร็จของรอบเก่าทับรอบที่ผิด
4. เปิด request/response เพื่อแสดงปลายทาง TOTP ของ Primary; passCode แสดง `[REDACTED]` และล้างออกจากช่องหลังส่ง ไม่เก็บรหัสใน JSON report

**TOTP สร้างรหัสบนมือถือและ REST API ใช้ตรวจรหัสนั้น ไม่ใช่การส่งรหัสไปมือถือ** หากคำว่า “เรียก Time-based OTP ไปยัง Primary” ใน TOR ต้องการพฤติกรรมอื่น ต้องยืนยันเกณฑ์กับผู้ประเมินก่อน ไม่จำลองการส่ง Push ให้ดูเหมือน TOTP

## REST และ Source code ที่ใช้จริง

Browser เรียก `POST /api/okta/test-user/primary/verify`:

```json
{ "method": "push" }
```

หรือ TOTP (ตัวอย่างปกปิดรหัส ไม่ใช่ payload สำหรับส่งตามตัวอักษร):

```json
{ "method": "totp", "passCode": "[รหัสล่าสุดจากอุปกรณ์ Primary]" }
```

Server ตรวจ session เจ้าของบัญชี + Origin/JSON แล้วอ่าน Primary จาก PostgreSQL ตรวจว่า factor ยัง ACTIVE และเป็นประเภทที่ถูกต้อง จึงเรียก Okta:

```text
POST /api/v1/users/{testUserId}/factors/{savedPrimaryFactorId}/verify
GET  /api/v1/users/{testUserId}/factors/{pushFactorId}/transactions/{transactionId}
```

ห้ามส่ง factorId/userId เพื่อ override ปลายทางใน primary/verify; API Token/SSWS ใช้บน server เท่านั้น ไม่แสดงค่าจริงในหน้าเดโม

กด **เปิด Source code** ที่ http://localhost:3000/api-test/primary/source เพื่อเปิดแท็บใหม่ โดยคงผลที่หน้าเดโมเดิมไว้ แสดงไฟล์จริงที่อ่านแบบ fixed allowlist:

- `web/app/api/okta/test-user/primary/verify/route.ts` — อ่าน Primary, verify Push/TOTP, ปกปิด passCode
- `web/app/api/okta/test-user/factors/[factorId]/transactions/[transactionId]/route.ts` — polling
- `web/app/api/okta/test-user/primary/route.ts` — บันทึก Primary และจับคู่ TOTP
- `web/lib/okta.ts` — owner guard, CSRF, SSWS fetch และ safe transaction DTO

ไม่มี file-path parameter ที่ใช้เปิด `.env.local` ได้

## เก็บหลักฐาน

กด **ดาวน์โหลดผล JSON** เมื่อจบแต่ละรอบ รายงานประกอบด้วยบัญชี, เวลา, target factor, ผลแยก Push/TOTP และ REST traces ที่ปกปิด passCode/SSWS ให้ดาวน์โหลดก่อน refresh/เปลี่ยน Primary เพราะผลทดสอบอยู่ในหน่วยความจำหน้าเว็บ ไม่ได้บันทึกเป็นผลผ่าน TOR อัตโนมัติ

ตรวจเทียบกับอุปกรณ์และ Okta System Log แล้วบันทึกผู้ทดสอบ/ผู้รับรอง แยกหลักฐานจริงจากภาพ `primary-demo-*-mocked.png` ซึ่งเป็น local UI test และไม่ได้ส่ง MFA จริง

## ตรวจซ้ำโดยไม่ส่ง MFA จริง

```sh
npm run verify:primary
npm run verify:api
node scripts/browser-check.mjs
docker compose exec web npm run typecheck
```

Handler unit tests จำลอง Okta/PostgreSQL: 13 กรณี รวม Primary ไม่มี/ผิดประเภท/INACTIVE, TOTP ผิด, owner/Origin และ passCode redaction; HTTP smoke 29 กรณีเป็น local signed-session fixtures และ read-only API; browser tests intercept MFA endpoints ทั้งหมด ไม่เขียน Primary/ส่ง Push/ตรวจ TOTP จริง

ไม่เพิ่ม npm dependency และไม่ต้อง build production image; Next dev server hot reload ตามเดิม

อ้างอิง API contract จาก Okta: [Push verification / Number Matching และ polling](https://raw.githubusercontent.com/okta/okta-sdk-nodejs/master/src/types/generated/models/Push1.d.ts), [TOTP verification ด้วย passCode ปัจจุบัน](https://raw.githubusercontent.com/okta/okta-sdk-nodejs/master/src/types/generated/models/TokenSoftwareTotp1.d.ts)
