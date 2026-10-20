# OIDC: Okta แจ้งว่าไม่ได้รับอนุญาตให้เข้าแอป

## สาเหตุที่ยืนยันจาก System Log

ตรวจเมื่อ 20 ตุลาคม 2026 (เวลาไทย): event `app.oauth2.as.authorize` ล่าสุดของ Web OIDC เวลา `2026-10-19T18:32:11.112Z` มีผล `FAILURE` และ reason `no_matching_policy` ขณะที่ Authorization Server `default` ไม่มี Access Policy เลย (`GET .../policies` คืน `[]`)

ผู้ใช้ `pamornko@gmail.com` ถูก assign เข้าแอปอยู่แล้ว และมี Okta Verify Push สถานะ ACTIVE ส่วน app sign-in policy กำหนด Password + Okta Verify Push ดังนั้นข้อผิดพลาดรอบนี้เกิดที่ขั้นตอนอนุญาตออก token หลังยืนยันตัวตน ไม่ใช่ปัญหา MFA enrollment ที่พบใน log เก่าก่อนหน้านี้

## การแก้ไขที่ทำแล้ว

เพิ่มการตั้งค่าที่ Okta โดยจำกัดเฉพาะ Web OIDC:

| รายการ | ค่า |
| --- | --- |
| Authorization Server | `default` (`aus18w4egci47Ka13698`) |
| Policy | `EGAT-POC Web OIDC - Authorization Code` |
| Policy ID | `00p18w8sgabTDgY1p698` |
| Client | `0oa18w4v07ywMQE69698` เท่านั้น |
| Rule | `Web sign-in - openid profile email` |
| Rule ID | `0pr18w8ryouqz6RWr698` |
| Grant | `authorization_code` เท่านั้น |
| Scopes | `openid`, `profile`, `email` |
| Access token lifetime | 60 นาที |

Rule ใช้กลุ่ม Everyone ภายใน Policy ที่จำกัด client นี้ โดยผู้ใช้ยังต้องถูก assign เข้าแอปและผ่าน Password + Okta Verify Push ตาม app sign-in policy เดิม ไม่ได้เพิ่มสิทธิ์แอปให้ผู้ใช้ใหม่ และไม่ได้เปลี่ยน MFA, SAML, Mobile หรือแอปอื่น

อ่านค่ากลับผ่าน Okta Management API แล้วยืนยันว่า Policy และ Rule เป็น ACTIVE, client/grant/scopes ตรงกับคำขอของเว็บ และ MFA ยังคงเป็น 2FA พร้อม Okta Verify Push

## ทดสอบในเบราว์เซอร์

1. กลับ `http://localhost:3000` แล้วกดเข้าสู่ระบบด้วย OIDC ใหม่ อย่า refresh คำขอหรือ callback เก่า
2. ใช้บัญชีที่ assign เข้าแอป และยืนยัน Okta Verify ให้ครบ
3. ตรวจว่ากลับ `/api/oidc/callback` และเข้า `/success` พร้อมแสดงข้อมูลบัญชี
4. หากยังไม่ผ่าน ให้ตรวจ System Log รอบใหม่ โดยดู `app.oauth2.as.authorize` และผล token exchange แยกจาก app sign-in policy

การตรวจ configuration ผ่าน API ไม่ใช่หลักฐานว่า login ครบ flow ในเบราว์เซอร์ผ่านแล้ว ขั้นตอนที่ต้องใช้บัญชีและ MFA จริงยังต้องทดสอบโดยผู้ใช้ ไม่ต้อง rebuild หรือ restart Docker สำหรับการแก้ไข Policy ครั้งนี้

## ย้อนการเปลี่ยนแปลง

หากต้องย้อน ให้ deactivate เฉพาะ Policy ID `00p18w8sgabTDgY1p698` ที่ `Security → API → Authorization Servers → default → Access Policies` ซึ่งจะทำให้ Web OIDC กลับไปไม่มี Policy ออก token อย่า deactivate app sign-in policy ที่ใช้ร่วมกับแอป POC อื่น

อ้างอิง: [Okta: เพิ่ม authorization server policy และ rules](https://developer.okta.com/docs/guides/terraform-create-custom-auth-server/main/)
