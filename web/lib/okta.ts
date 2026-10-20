import "server-only";

import { config } from "./config";
import { getSession } from "./session";
import { getAccountProfile } from "./account-profile";
import { NextResponse } from "next/server";

function oktaBaseUrl(): string {
  return config.issuer.split("/oauth2/")[0];
}

export function requireTestUserId(): string {
  if (!config.oktaTestUserId) {
    throw new ApiError(503, "ยังไม่ได้กำหนด OKTA_TEST_USER_ID สำหรับ MFA console");
  }
  return config.oktaTestUserId;
}

export async function isAuthenticated(): Promise<boolean> {
  return Boolean(await getSession());
}

export async function oktaManagementFetch(path: string, init: RequestInit = {}) {
  if (!/^\/api\/v1\//.test(path) || path.includes("..")) throw new Error("Invalid Okta API path");
  return fetch(oktaBaseUrl() + path, {
    ...init,
    headers: {
      Authorization: "SSWS " + config.apiToken,
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(init.headers ?? {})
    },
    cache: "no-store",
    signal: AbortSignal.timeout(15000),
    redirect: "error"
  });
}

export async function readJsonBody(request: Request): Promise<Record<string, unknown>> {
  const body = await request.json().catch(() => { throw new ApiError(400, "ส่งข้อมูล JSON ไม่ถูกต้อง"); });
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new ApiError(400, "Request body must be a JSON object");
  }
  return body as Record<string, unknown>;
}

export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export function apiFailure(error: unknown) {
  return NextResponse.json({ error: error instanceof ApiError ? error.message : "ติดต่อระบบทดสอบไม่สำเร็จ กรุณาตรวจ configuration หรือทดลองใหม่" }, {
    status: error instanceof ApiError ? error.status : 502, headers: { "Cache-Control": "no-store" }
  });
}

export async function oktaJson(path: string, init: RequestInit = {}) {
  const response = await oktaManagementFetch(path, init);
  const data = await response.json();
  if (!response.ok) {
    const message = response.status === 429 ? "ส่งคำขอบ่อยเกินไป รอสักครู่ก่อนลองใหม่" : response.status === 403 ? "Okta ไม่อนุญาตรายการนี้ ตรวจสิทธิ์ API / policy" : response.status === 404 ? "ไม่พบผู้ใช้หรือ factor นี้" : "Okta ไม่รับรายการนี้ ตรวจรหัสยืนยัน สถานะ factor และ policy";
    throw new ApiError(response.status >= 500 ? 502 : response.status, message);
  }
  return data;
}

export async function authorizedTestUser(request?: Request) {
  const session = await getSession();
  if (!session) throw new ApiError(401, "กรุณาเข้าสู่ระบบก่อนใช้ MFA console");
  if (request && request.method !== "GET") {
    if (request.headers.get("origin") !== new URL(config.webBaseUrl).origin) throw new ApiError(403, "คำขอไม่ได้มาจากเว็บไซต์นี้");
    if (!request.headers.get("content-type")?.startsWith("application/json")) throw new ApiError(415, "ต้องส่ง application/json");
  }
  const userId = requireTestUserId();
  const user = await oktaJson(`/api/v1/users/${encodeURIComponent(userId)}`);
  const profile = getAccountProfile(session);
  const isOwner = session.protocol === "saml"
    ? profile.account?.toLowerCase() === String(user.profile?.login).toLowerCase()
    : session.sub === user.id;
  if (!isOwner) throw new ApiError(403, "MFA console อนุญาตเฉพาะเจ้าของบัญชีทดสอบที่กำหนดไว้ ไม่สามารถจัดการ MFA ของผู้อื่น");
  return { id: userId, user };
}

export function factorId(value: string) {
  if (!/^[a-zA-Z0-9_-]{5,100}$/.test(value)) throw new ApiError(400, "Factor ID ไม่ถูกต้อง");
  return encodeURIComponent(value);
}

export function passCode(body: Record<string, unknown>) {
  if (typeof body.passCode !== "string" || !/^\d{6,8}$/.test(body.passCode)) throw new ApiError(400, "กรอกรหัสยืนยัน 6–8 หลัก");
  return { passCode: body.passCode };
}

export function safeFactor(factor: Record<string, any>) {
  const activation = factor._embedded?.activation;
  const qr = activation?._links?.qrcode?.href;
  // QR/activation links are sensitive enrollment credentials: show only to owner; never save/log them.
  return {
    id: factor.id, factorType: factor.factorType, provider: factor.provider, status: factor.status,
    device: factor.profile?.name ?? factor.profile?.deviceType ?? factor.profile?.credentialId,
    activation: activation ? {
      expiresAt: activation.expiresAt,
      qrCode: typeof qr === "string" && qr.startsWith(oktaBaseUrl() + "/") ? qr : undefined
    } : undefined
  };
}

export function safeTransaction(data: Record<string, any>, id: string, userId: string) {
  const poll = data._links?.poll?.href;
  let transactionId: string | undefined;
  if (typeof poll === "string") {
    const url = new URL(poll);
    const prefix = `/api/v1/users/${userId}/factors/${id}/transactions/`;
    if (url.origin === oktaBaseUrl() && url.pathname.startsWith(prefix)) {
      const candidate = url.pathname.slice(prefix.length);
      if (/^[a-zA-Z0-9_-]{5,150}$/.test(candidate)) transactionId = candidate;
    }
  }
  return { factorResult: data.factorResult, status: data.status, expiresAt: data.expiresAt,
    correctAnswer: data._embedded?.challenge?.correctAnswer, transactionId };
}

