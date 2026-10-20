# Mobile dev / demo

## รัน

1. รัน Web + PostgreSQL: `docker compose up -d`
2. ใน `mobile` รัน `npm install`
3. ใช้ค่าจาก `.env.example` เป็นแนวทางสร้าง `mobile/.env.local` (public config เท่านั้น ห้ามใส่ API Token หรือ Client Secret)
4. Android emulator ใช้ `EXPO_PUBLIC_API_BASE_URL=http://10.0.2.2:3000`; เครื่องจริงผ่าน USB ใช้ `adb reverse tcp:3000 tcp:3000` และ API base `http://127.0.0.1:3000`
5. รัน `npm run android` เพื่อสร้าง/ติดตั้ง **debug development build** และเปิด Metro; ถ้าติดตั้งแล้วใช้ `npm start`
6. iOS ใช้ `npm run ios` บนเครื่องที่ติดตั้ง Xcode เต็มและมี Simulator/อุปกรณ์พร้อม; เครื่องนี้ยังไม่มี `simctl`

ไม่ใช้ Expo Go เพื่อยืนยัน native callback/Face ID ใช้ scheme `com.egat.poc:/callback` และ logout `com.egat.poc:/logout` ตรงตาม Okta registration

Web/DB เปิดเฉพาะ loopback ของเครื่อง host อย่าเปิด POC นี้สู่ internet หากจำเป็นต้องทดสอบ iPhone ผ่าน LAN ให้จัด dev endpoint ที่ปลอดภัยและกำหนด API base ให้เข้าถึงได้ก่อน HTTP ใช้เฉพาะ dev loopback/เครือข่ายที่ไว้ใจได้ ต้องใช้ HTTPS ก่อนใช้นอก local

## โค้ดทำอะไร

- AuthSession discovery/hook อยู่ใน React component; Authorization Code + S256 PKCE และ nonce
- เปิด system authentication browser ตาม policy ของ Okta
- แลก code ด้วย verifier โดยไม่มี Client Secret
- ส่ง ID token ไป `/api/mobile/verify` ตรวจ JWKS signature, issuer, **Mobile audience**, expiry, nonce; endpoint นี้ไม่สร้าง Web session
- แสดง Account/email/employee_code/department จาก claims ที่ตรวจแล้ว
- เก็บ session ใน SecureStore, ตรวจหมดอายุและล็อกข้อมูลเมื่อ app เข้า background
- ปลดล็อกด้วย Biometrics หรือ OS authentication ที่อนุญาต device PIN/passcode fallback ไม่เก็บ PIN ของผู้ใช้เอง
- Logout ล้าง SecureStore และไป Okta end-session พร้อม registered callback

การปลดล็อกเครื่องไม่ใช่การ Login ที่ Okta และไม่อ้างว่ารหัสอุปกรณ์จะถูกถามทุกครั้ง เพราะ OS อาจเลือก Biometrics ตามการตั้งค่าของเครื่อง

## Policy ที่ตรวจอ่านกลับแล้ว (20 ต.ค. 2026)

- Mobile token policy: `00p18wugvz8DYxsRr698`, rule `0pr18wudn25r4FKO4698` — authorization_code + openid/profile/email, access token 60 นาที
- Mobile-only app sign-in policy: `rst18wujc5jR9iert698`, rule `rul18wujtwpfZzmiL698` เฉพาะกลุ่ม EGAT-POC-Testers
- อนุญาตสองทางเลือก: Password + Okta Verify Push **หรือ** Okta Verify FastPass (`signed_nonce`) ที่บังคับ user verification และ phishing resistance; factorMode 2FA
- Web OIDC/SAML ยังใช้ policy เดิม `rst18w7vob4oKMyR2698` ไม่เปลี่ยน global session/enrollment policy
- สคริปต์ดูแผน: `node scripts/configure-mobile-policy.mjs`; ใส่ `--apply` เมื่อต้องการ apply ซ้ำโดยเจตนา

FastPass ต้องติดตั้งและลงทะเบียน Okta Verify บนอุปกรณ์ที่ Login จริง การมี enrollment บนโทรศัพท์อีกเครื่องไม่พิสูจน์ FastPass บน emulator

## ข้อจำกัด TOR 5.2 ที่ต้องตกลงก่อนสรุปผ่าน

TOR ระบุ **Factor 1 = PIN/Biometrics และ Factor 2 = Push + Number Matching**. Policy ทางเลือก FastPass + user verification ด้านบนเป็น scenario เพิ่ม ไม่ใช่หลักฐานว่าได้ทำสองขั้นตอนตามข้อความ TOR นี้ครบ การปลดล็อก local app แล้ว Login แบบ Password + Push ก็ไม่ใช่ Passwordless

ต้องยืนยันกับ Okta/ผู้รับรอง TOR ว่าต้องใช้ authentication-method chain แบบใด/รองรับบน tenant และ license นี้หรือไม่ หรือยอมรับ FastPass เป็น equivalent ก่อนสรุปผล ไม่แก้ Web/SAML policy ให้อ่อนลงเพื่อเลียนแบบผลผ่าน

## ผลที่ตรวจแล้ว / ยังรอ

- ผ่าน `npm run typecheck`
- ผ่าน `npm run export:check` — Metro สร้าง Android Hermes bundle; **ไม่ใช่ APK หรือผล Login จริง**
- สร้าง native Android project แล้ว มี deep-link intent filter และ Biometrics permission; ปิด Android allowBackup
- `expo run:android` ลองเปิด AVD แล้ว timeout; ไม่มีอุปกรณ์ใน `adb devices` ในรอบตรวจ
- Android debug Gradle build ผ่านแล้ว ได้ `mobile/android/app/build/outputs/apk/debug/app-debug.apk` (arm64-v8a); ตรวจ package/signature แล้ว แต่ยังไม่ติดตั้งหรือรันบนอุปกรณ์
- ยังรอ Android/iOS จริง: callback, login, custom claims, SecureStore restore, background lock, PIN/Biometrics, Logout, Push/Number Matching, FastPass และการสลับสองบัญชี

อย่าเก็บ QR enrollment, code, verifier, passcode, ID token/Access token เต็มในภาพหรือ WikiKai

ติดตั้ง debug APK เมื่อเชื่อม Android แล้ว: `adb install -r android/app/build/outputs/apk/debug/app-debug.apk` จากโฟลเดอร์ mobile จากนั้นรัน `npm start` และเปิด development client เพื่อเชื่อม Metro. การ rebuild แบบไม่ต้องเปิด emulator ใช้ `NODE_ENV=development ./gradlew :app:assembleDebug -PreactNativeArchitectures=arm64-v8a` ใน mobile/android โดยตั้ง JAVA_HOME/ANDROID_HOME ให้ถูกต้อง.

อ้างอิงหลัก: [Okta Authorization Code + PKCE](https://developer.okta.com/docs/guides/implement-grant-type/authcodepkce/main/), [การตั้ง FastPass และ app sign-in policy](https://help.okta.com/oie/en-us/content/Topics/identity-engine/devices/fp/fp-configure.htm), [Expo LocalAuthentication](https://docs.expo.dev/versions/latest/sdk/local-authentication/). โค้ดนี้ใช้ API/packages ที่เข้ากับ Expo 51 ไม่ใช่การอัปเกรดตาม latest SDK.
