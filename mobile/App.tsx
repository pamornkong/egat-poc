import React, { useEffect, useRef, useState } from "react";
import { AppState, Button, Platform, SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";
import * as AuthSession from "expo-auth-session";
import * as SecureStore from "expo-secure-store";
import * as LocalAuthentication from "expo-local-authentication";
import * as Crypto from "expo-crypto";
import * as WebBrowser from "expo-web-browser";

WebBrowser.maybeCompleteAuthSession();
const issuer = process.env.EXPO_PUBLIC_OKTA_ISSUER ?? "https://trial-3224781.okta.com/oauth2/default";
const clientId = process.env.EXPO_PUBLIC_OKTA_CLIENT_ID ?? "0oa18w4zg671gJAOV698";
const apiBase = (process.env.EXPO_PUBLIC_API_BASE_URL ?? (Platform.OS === "android" ? "http://10.0.2.2:3000" : "http://localhost:3000")).replace(/\/$/, "");
const redirectUri = "com.egat.poc:/callback"; // Must match the registered Okta native URI exactly.
const logoutUri = "com.egat.poc:/logout";
const storageKey = "egat.poc.session.v1";
type Profile = { sub?: string; account?: string; name?: string; email?: string; employee_code?: string; department?: string };
type Session = { idToken: string; accessToken: string; nonce: string; expiresAt: number; profile: Profile };

export default function App() {
  const discovery = AuthSession.useAutoDiscovery(issuer);
  const [nonce, setNonce] = useState(() => Crypto.randomUUID());
  const [request, response, promptAsync] = AuthSession.useAuthRequest({
    clientId, redirectUri, scopes: ["openid", "profile", "email"], responseType: AuthSession.ResponseType.Code,
    usePKCE: true, extraParams: { nonce }
  }, discovery);
  const [session, setSession] = useState<Session | null>(null);
  const [locked, setLocked] = useState(true);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("กำลังตรวจ session บนอุปกรณ์…");
  const handled = useRef<string>();
  const browserBusy = useRef(false);

  async function validate(idToken: string, expectedNonce: string) {
    const result = await fetch(apiBase + "/api/mobile/verify", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken, nonce: expectedNonce })
    });
    if (!result.ok) throw new Error("ตรวจ ID token ไม่ผ่าน หรือ session หมดอายุ");
    const data = await result.json() as { profile: Profile; expiresAt: number };
    if (!data.profile.sub || !Number.isFinite(data.expiresAt) || data.expiresAt * 1000 <= Date.now()) throw new Error("ID token ไม่ครบหรือหมดอายุ");
    return data;
  }
  async function forget() {
    await SecureStore.deleteItemAsync(storageKey);
    setSession(null); setLocked(true); setNonce(Crypto.randomUUID());
  }
  useEffect(() => {
    let mounted = true;
    SecureStore.getItemAsync(storageKey).then(async value => {
      if (!value) { if (mounted) setStatus("ยังไม่ได้เข้าสู่ระบบ"); return; }
      const saved = JSON.parse(value) as Session;
      if (!saved.idToken || saved.expiresAt * 1000 <= Date.now()) { await SecureStore.deleteItemAsync(storageKey); if (mounted) setStatus("session หมดอายุ กรุณา Login ใหม่"); return; }
      if (mounted) { setSession(saved); setLocked(true); setStatus("มี session บนอุปกรณ์ กรุณาปลดล็อก"); }
    }).catch(() => { if (mounted) setStatus("อ่าน SecureStore ไม่สำเร็จ กรุณา Login ใหม่"); });
    const subscription = AppState.addEventListener("change", state => {
      if (state !== "active" && !browserBusy.current) setLocked(true);
    });
    return () => { mounted = false; subscription.remove(); };
  }, []);
  useEffect(() => {
    if (!session) return;
    const timer = setTimeout(() => { void forget().then(() => setStatus("session หมดอายุ กรุณา Login ใหม่")); }, Math.max(0, session.expiresAt * 1000 - Date.now()));
    return () => clearTimeout(timer);
  }, [session?.expiresAt]);

  useEffect(() => {
    if (response?.type === "success" && request?.codeVerifier && discovery && handled.current !== response.params.code) {
      handled.current = response.params.code;
      setBusy(true); setStatus("กำลังแลก code และตรวจสอบ ID token…");
      void (async () => {
        const token = await AuthSession.exchangeCodeAsync({ clientId, code: response.params.code, redirectUri, extraParams: { code_verifier: request.codeVerifier! } }, discovery);
        if (!token.idToken) throw new Error("Okta ไม่ได้ส่ง ID token");
        const verified = await validate(token.idToken, nonce);
        const saved: Session = { idToken: token.idToken, accessToken: token.accessToken, nonce, ...verified };
        await SecureStore.setItemAsync(storageKey, JSON.stringify(saved));
        setSession(saved); setLocked(false); setStatus("Login สำเร็จ · ID token ตรวจ signature / issuer / audience / expiry / nonce แล้ว");
      })().catch(() => setStatus("Login ไม่สำเร็จ ตรวจการเชื่อมต่อ API, callback และ policy ของ Mobile app"))
        .finally(() => setBusy(false));
    } else if (response?.type === "error") setStatus("Okta ปฏิเสธการเข้าสู่ระบบ กรุณาตรวจ policy และสิทธิ์ของบัญชี");
    else if (response?.type === "cancel" || response?.type === "dismiss") setStatus("ยกเลิกการเข้าสู่ระบบ");
  }, [response, request, discovery]);

  async function unlock(biometricsOnly: boolean) {
    if (!session || busy) return;
    setBusy(true);
    try {
      if (session.expiresAt * 1000 <= Date.now()) { await forget(); throw new Error("session หมดอายุ กรุณา Login ใหม่"); }
      if (biometricsOnly && (!await LocalAuthentication.hasHardwareAsync() || !await LocalAuthentication.isEnrolledAsync())) throw new Error("อุปกรณ์ยังไม่มี Biometrics ที่ลงทะเบียน");
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: biometricsOnly ? "ปลดล็อก EGAT-POC ด้วย Biometrics" : "ปลดล็อก EGAT-POC ด้วยการยืนยันของอุปกรณ์",
        disableDeviceFallback: biometricsOnly, fallbackLabel: "ใช้รหัสอุปกรณ์", cancelLabel: "ยกเลิก"
      });
      if (!result.success) throw new Error("ยังไม่ผ่านการปลดล็อกอุปกรณ์");
      const verified = await validate(session.idToken, session.nonce);
      setSession({ ...session, ...verified }); setLocked(false); setStatus("ปลดล็อกข้อมูลบัญชีแล้ว");
    } catch (error) { setLocked(true); setStatus(error instanceof Error ? error.message : "ปลดล็อกไม่สำเร็จ"); }
    finally { setBusy(false); }
  }
  async function logout() {
    if (!session) return;
    const idToken = session.idToken;
    setBusy(true); browserBusy.current = true;
    try {
      await forget();
      const url = issuer + "/v1/logout?" + new URLSearchParams({ id_token_hint: idToken, post_logout_redirect_uri: logoutUri }).toString();
      const result = await WebBrowser.openAuthSessionAsync(url, logoutUri);
      setStatus(result.type === "success" ? "ออกจากแอปและจบ Okta session แล้ว" : "ล้าง session ในแอปแล้ว แต่ยังต้องยืนยันการออกจาก Okta ใน browser");
    } catch { setStatus("ล้าง session ในแอปแล้ว หาก Okta ไม่ตอบกลับ ให้ตรวจ Sign-out URI"); }
    finally { browserBusy.current = false; setBusy(false); }
  }

  return <SafeAreaView style={styles.safe}><ScrollView contentContainerStyle={styles.container}>
    <Text style={styles.eyebrow}>SECURE MOBILE WORKSPACE</Text><Text style={styles.title}>EGAT-POC</Text>
    <Text style={styles.copy}>OIDC + PKCE · Okta Verify · Device unlock</Text>
    <View style={styles.card}><Text style={styles.cardTitle}>สถานะ</Text><Text style={styles.copy} accessibilityLiveRegion="polite">{status}</Text></View>
    {!session && <Button title="เข้าสู่ระบบด้วย Okta" color="#187344" disabled={!request || busy} onPress={() => { browserBusy.current = true; void promptAsync().finally(() => { browserBusy.current = false; }); }} />}
    {session && locked && <View style={styles.card}><Text style={styles.cardTitle}>ข้อมูลบัญชีถูกล็อก</Text><Button title="ปลดล็อกด้วย Biometrics" color="#187344" disabled={busy} onPress={() => void unlock(true)} /><Button title="ยืนยันด้วยอุปกรณ์ / PIN fallback" color="#0d482f" disabled={busy} onPress={() => void unlock(false)} /></View>}
    {session && !locked && <View style={styles.card}><Text style={styles.cardTitle}>{session.profile.name ?? session.profile.account}</Text>{(["account", "email", "employee_code", "department"] as const).map(key => <View key={key}><Text style={styles.label}>{key}</Text><Text selectable style={styles.value}>{session.profile[key] ?? "ยังไม่ได้รับข้อมูล"}</Text></View>)}<Button title="ล็อกหน้าจอแอป" color="#187344" onPress={() => setLocked(true)} /></View>}
    {session && <Button title="ออกจากระบบ + Okta" color="#963c2e" disabled={busy} onPress={() => void logout()} />}
    <View style={styles.card}><Text style={styles.cardTitle}>ขอบเขตการทดสอบ</Text><Text style={styles.copy}>PIN/Biometrics ด้านบนใช้ปลดล็อกข้อมูลในเครื่อง ไม่ใช่ Okta Passwordless Login; การพิสูจน์ FastPass ต้องมี policy และอุปกรณ์ที่ลงทะเบียนจริง ส่วน Push ทำผ่าน Okta Hosted Sign-In ตาม policy</Text><Text style={styles.label}>Native callback</Text><Text selectable style={styles.value}>{redirectUri}</Text><Text style={styles.label}>Validation API (dev local)</Text><Text selectable style={styles.value}>{apiBase}</Text></View>
    <Text style={styles.note}>ต้องใช้ development build สำหรับ scheme และ Face ID จริง ไม่ใช้ Expo Go เป็นหลักฐานผ่าน Android/iOS ใช้ HTTPS ก่อนใช้งานนอกเครือข่าย local ที่ไว้ใจได้</Text>
  </ScrollView></SafeAreaView>;
}
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#eff8f1" }, container: { padding: 24, paddingTop: 40, gap: 18 },
  eyebrow: { color: "#187344", fontSize: 11, fontWeight: "700", letterSpacing: 2 },
  title: { fontSize: 40, fontWeight: "800", color: "#0d482f" }, copy: { color: "#527261", lineHeight: 24, fontSize: 15 },
  card: { backgroundColor: "#fff", borderRadius: 20, padding: 22, gap: 14, borderColor: "#cfe6d5", borderWidth: 1 },
  cardTitle: { color: "#0d482f", fontSize: 20, fontWeight: "700" }, label: { color: "#5d7468", fontSize: 11 },
  value: { color: "#17352a", fontSize: 15, marginTop: 4 }, note: { color: "#5d7468", lineHeight: 22, fontSize: 12 }
});
