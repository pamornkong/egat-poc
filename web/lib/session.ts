import "server-only";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { config } from "./config";

const name = "egat_poc_session";
function secret() { return new TextEncoder().encode(config.sessionSecret); }

export async function setSession(payload: Record<string, unknown>) {
  const token = await new SignJWT(payload).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime("8h").sign(secret());
  cookies().set(name, token, { httpOnly: true, sameSite: "lax", secure: config.webBaseUrl.startsWith("https://"), path: "/", maxAge: 28800 });
}

export async function getSession() {
  const token = cookies().get(name)?.value;
  if (!token) return null;
  try { return (await jwtVerify(token, secret())).payload; } catch { return null; }
}

export function clearSession() { cookies().delete(name); }
