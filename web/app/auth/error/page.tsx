import type { Metadata } from "next";
import ErrorScreen from "../../components/error-screen";
import { getAuthErrorCode, type AuthProtocol } from "../../../lib/auth-errors";

export const metadata: Metadata = { title: "ช่วยเหลือการเข้าใช้งาน | EGAT-POC", robots: { index: false, follow: false }, referrer: "no-referrer" };
export const dynamic = "force-dynamic";

export default function AuthErrorPage({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }) {
  const code = getAuthErrorCode(typeof searchParams.code === "string" ? searchParams.code : undefined);
  const protocol: AuthProtocol | undefined = searchParams.protocol === "oidc" || searchParams.protocol === "saml" || searchParams.protocol === "logout" ? searchParams.protocol : undefined;
  const reference = typeof searchParams.ref === "string" && /^[a-f0-9-]{36}$/.test(searchParams.ref) ? searchParams.ref : undefined;
  return <ErrorScreen code={code} protocol={protocol} reference={reference} />;
}
