import "./globals.css";
import type { Metadata } from "next";
import localFont from "next/font/local";

const manrope = localFont({
  src: "./fonts/manrope-latin-variable.woff2",
  variable: "--font-manrope",
  weight: "200 800",
  display: "swap",
  adjustFontFallback: false,
});

const anuphan = localFont({
  src: "./fonts/anuphan-thai-variable.woff2",
  variable: "--font-anuphan",
  weight: "100 700",
  display: "swap",
  adjustFontFallback: false,
});

export const metadata: Metadata = { title: "EGAT SSO POC", description: "Okta OIDC, SAML and MFA POC" };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="th" className={`${manrope.variable} ${anuphan.variable}`}><body>{children}</body></html>;
}
