/**
 * Notificações push (Web Push / VAPID) — usadas apenas pelo administrador.
 * No iOS só funciona com o app adicionado à Tela de Início.
 */
import { supabase } from "@/integrations/supabase/client";
import { detectDevice } from "@/lib/key-context";

/** Chave pública VAPID — pode ficar no código (é pública por definição). */
export const VAPID_PUBLIC_KEY =
  "BOiHPKDiRjBmVRwdjAWuzJ577UoRXOz7Uq5fxMas0tzaNWVkXN98_ZDiRzC3o6rfJLzoUzN1HhKtviFFrAnvYqQ";

export type PushStatus =
  | "unsupported"
  | "ios-needs-install"
  | "denied"
  | "ready"
  | "enabled";

function isIOS() {
  const ua = navigator.userAgent || "";
  return /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
}

function isStandalone() {
  return (
    window.matchMedia?.("(display-mode: standalone)").matches === true ||
    (navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

export function pushSupported() {
  return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

export async function currentPushStatus(): Promise<PushStatus> {
  if (!pushSupported()) return isIOS() && !isStandalone() ? "ios-needs-install" : "unsupported";
  if (isIOS() && !isStandalone()) return "ios-needs-install";
  if (Notification.permission === "denied") return "denied";
  try {
    const reg = await navigator.serviceWorker.getRegistration("/sw.js");
    const sub = await reg?.pushManager.getSubscription();
    if (sub) return "enabled";
  } catch {
    /* ignora */
  }
  return "ready";
}

function urlBase64ToUint8Array(base64: string) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const normalized = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(normalized);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export async function registerPushServiceWorker() {
  return navigator.serviceWorker.register("/sw.js", { scope: "/" });
}

/** Cadastra este aparelho para o admin. Retorna o status final. */
export async function enableAdminPush(password: string): Promise<PushStatus> {
  const status = await currentPushStatus();
  if (status === "unsupported" || status === "ios-needs-install" || status === "denied") return status;

  const permission =
    Notification.permission === "granted" ? "granted" : await Notification.requestPermission();
  if (permission !== "granted") return "denied";

  const registration = await registerPushServiceWorker();
  await navigator.serviceWorker.ready;

  const existing = await registration.pushManager.getSubscription();
  const subscription =
    existing ??
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    }));

  const json = subscription.toJSON();
  const { error } = await supabase.rpc("admin_save_push_subscription", {
    _password: password,
    _endpoint: json.endpoint ?? subscription.endpoint,
    _p256dh: json.keys?.p256dh ?? "",
    _auth: json.keys?.auth ?? "",
    _device: detectDevice(),
  });
  if (error) throw error;

  return "enabled";
}

/** Remove a inscrição deste aparelho (e do banco, se o id for informado). */
export async function disableAdminPush(password: string, id?: string) {
  try {
    const reg = await navigator.serviceWorker.getRegistration("/sw.js");
    const sub = await reg?.pushManager.getSubscription();
    await sub?.unsubscribe();
  } catch {
    /* ignora */
  }
  if (id) {
    const { error } = await supabase.rpc("admin_delete_push_subscription", { _password: password, _id: id });
    if (error) throw error;
  }
}

/** Dispara a notificação para os aparelhos do admin. Nunca lança erro. */
export async function notifyAdmin(kind: "message" | "receipt", key: string) {
  try {
    await supabase.functions.invoke("notify-admin", { body: { kind, key } });
  } catch (err) {
    console.warn("Não foi possível notificar o admin:", err);
  }
}
