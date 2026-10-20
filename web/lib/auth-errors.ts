export const authErrors = {
  access_denied: {
    title: "บัญชีนี้ยังเข้าใช้งานไม่ได้",
    message: "Okta ไม่อนุญาตให้บัญชีนี้เข้าใช้งานแอป หรือการเข้าสู่ระบบถูกยกเลิก",
    hint: "ลองเข้าสู่ระบบอีกครั้ง หากยังพบปัญหา ให้ผู้ดูแลตรวจสิทธิ์เข้าแอปและเงื่อนไข MFA ของบัญชีคุณ",
  },
  session_expired: {
    title: "คำขอเข้าสู่ระบบหมดอายุ",
    message: "คำขอนี้หมดอายุ ถูกใช้แล้ว หรือไม่ได้เริ่มจากเบราว์เซอร์นี้",
    hint: "เริ่มเข้าสู่ระบบใหม่จากปุ่มด้านล่าง และทำรายการให้เสร็จในแท็บเดียวกัน",
  },
  login_required: {
    title: "กรุณาเข้าสู่ระบบอีกครั้ง",
    message: "ยังไม่พบ session ที่ใช้งานได้ หรือ Okta ต้องการให้คุณยืนยันตัวตนเพิ่มเติม",
    hint: "เข้าสู่ระบบใหม่ แล้วทำขั้นตอนยืนยันตัวตนให้ครบก่อนกลับมาใช้งาน",
  },
  configuration_error: {
    title: "การเชื่อมต่อยังไม่พร้อมใช้งาน",
    message: "การตั้งค่าการเข้าสู่ระบบยังไม่ครบ หรือข้อมูลแอปไม่ตรงกับที่ผู้ให้บริการกำหนด",
    hint: "แจ้งผู้ดูแลให้ตรวจการตั้งค่าแอปและ URL สำหรับกลับเข้าเว็บ จากนั้นลองใหม่อีกครั้ง",
  },
  provider_unavailable: {
    title: "เชื่อมต่อบริการยืนยันตัวตนไม่ได้",
    message: "ขณะนี้เว็บติดต่อบริการยืนยันตัวตนไม่สำเร็จ",
    hint: "รอสักครู่แล้วลองอีกครั้ง หากยังใช้งานไม่ได้ ให้แจ้งผู้ดูแลพร้อมรหัสอ้างอิงด้านล่าง",
  },
  invalid_callback: {
    title: "ลิงก์เข้าสู่ระบบไม่สมบูรณ์",
    message: "ข้อมูลที่ใช้รับผลการเข้าสู่ระบบไม่ครบ หรือคุณเปิดลิงก์รับผลโดยตรง",
    hint: "เริ่มจากปุ่มเข้าสู่ระบบด้านล่าง แทนการเปิดหรือรีเฟรชลิงก์รับผลเดิม",
  },
  token_exchange_failed: {
    title: "เข้าสู่ระบบไม่สำเร็จ",
    message: "เว็บรับผลการยืนยันตัวตนจาก Okta ไม่สำเร็จ คำขออาจหมดอายุหรือถูกใช้แล้ว",
    hint: "เริ่มเข้าสู่ระบบใหม่ หากเกิดซ้ำ ให้แจ้งผู้ดูแลพร้อมรหัสอ้างอิง",
  },
  invalid_response: {
    title: "ยืนยันผลการเข้าสู่ระบบไม่ได้",
    message: "ข้อมูลยืนยันตัวตนไม่สมบูรณ์ หมดอายุ หรือไม่ผ่านการตรวจสอบ",
    hint: "เพื่อให้เข้าสู่ระบบได้อย่างถูกต้อง กรุณาเริ่มรายการใหม่จากปุ่มด้านล่าง",
  },
  saml_failed: {
    title: "เข้าสู่ระบบด้วย SAML ไม่สำเร็จ",
    message: "เว็บตรวจสอบผลการยืนยันตัวตนจากผู้ให้บริการไม่ผ่าน",
    hint: "ลองเข้าสู่ระบบใหม่ หากยังเกิดซ้ำ ให้ผู้ดูแลตรวจการตั้งค่า SAML และใบรับรองของแอป",
  },
  logout_failed: {
    title: "ออกจาก Okta ยังไม่สำเร็จ",
    message: "เว็บล้าง session ในเครื่องนี้แล้ว แต่ยังส่งคำขอออกจาก Okta ไม่สำเร็จ",
    hint: "ลองออกจากระบบอีกครั้งเพื่อจบ session ที่ Okta ก่อนเปลี่ยนไปใช้บัญชีอื่น",
  },
  unexpected: {
    title: "มีบางอย่างขัดข้อง",
    message: "ระบบทำรายการนี้ไม่สำเร็จในขณะนี้",
    hint: "ลองอีกครั้ง หรือกลับหน้าแรก หากยังพบปัญหา ให้แจ้งผู้ดูแลพร้อมรหัสอ้างอิงถ้ามี",
  },
  not_found: {
    title: "ไม่พบหน้าที่คุณกำลังหา",
    message: "ลิงก์นี้อาจไม่ถูกต้อง หรือหน้าที่ต้องการไม่มีอยู่ในระบบ",
    hint: "กลับหน้าแรกเพื่อเลือกเมนูที่ต้องการใช้งาน",
  },
} as const;

export type AuthErrorCode = keyof typeof authErrors;
export type AuthProtocol = "oidc" | "saml" | "logout";

export function getAuthErrorCode(value: string | undefined): AuthErrorCode {
  return value && Object.prototype.hasOwnProperty.call(authErrors, value)
    ? value as AuthErrorCode
    : "unexpected";
}

export function providerErrorCode(value: string): AuthErrorCode {
  switch (value) {
    case "access_denied": return "access_denied";
    case "login_required":
    case "interaction_required":
    case "consent_required": return "login_required";
    case "invalid_client":
    case "unauthorized_client":
    case "invalid_request":
    case "invalid_scope":
    case "unsupported_response_type": return "configuration_error";
    case "server_error":
    case "temporarily_unavailable": return "provider_unavailable";
    default: return "unexpected";
  }
}
