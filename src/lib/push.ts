/**
 * Notificações push (Web Push / VAPID) — destinatário separado por aparelho.
 * No iOS só funciona com o app adicionado à Tela de Início.
 */
import { supabase } from "@/integrations/supabase/client";
import { detectDevice } from "@/lib/device";
import { withTimeout } from "@/lib/request-timeout";

/** Chave pública VAPID — pode ficar no código (é pública por definição). */
export const VAPID_PUBLIC_KEY =
  "BOiHPKDiRjBmVRwdjAWuzJ577UoRXOz7Uq5fxMas0tzaNWVkXN98_ZDiRzC3o6rfJLzoUzN1HhKtviFFrAnvYqQ";

export type PushStatus =
  | "unsupported"
  | "ios-needs-install"
  | "denied"
  | "unknown"
  | "admin-device"
  | "ready"
  | "enabled";

export type PushSubscriptionRecord = {
  id: string; endpoint: string; device: string | null; created_at: string; scope?: string | null;
};

const BINDING_KEY = "atlas_push_binding_v1";
type PushBinding = { endpoint: string; scope: "admin" | "user"; key?: string };

function readBinding(): PushBinding | null {
  try { return JSON.parse(localStorage.getItem(BINDING_KEY) ?? "null"); }
  catch { return null; }
}

function saveBinding(binding: PushBinding) {
  localStorage.setItem(BINDING_KEY, JSON.stringify(binding));
}

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

function pushAvailability(): PushStatus {
  if (!pushSupported()) return isIOS() && !isStandalone() ? "ios-needs-install" : "unsupported";
  if (isIOS() && !isStandalone()) return "ios-needs-install";
  if (Notification.permission === "denied") return "denied";
  return "ready";
}

export async function currentPushStatus(key?: string): Promise<PushStatus> {
  const available = pushAvailability();
  if (available !== "ready") return available;
  try {
    const reg = await navigator.serviceWorker.getRegistration("/sw.js");
    const sub = await reg?.pushManager.getSubscription();
    const binding = readBinding();
    if (Notification.permission !== "granted" || !sub || binding?.endpoint !== sub.endpoint) return "ready";
    if (key && binding.scope === "admin") return "admin-device";
    if (key && binding.scope === "user" && binding.key === key.trim().toUpperCase()) {
      const { data, error } = await withTimeout(supabase.rpc("user_push_status", { _key: key }));
      if (error) return "unknown";
      if (data === true) return "enabled";
    }
  } catch {
    return "unknown";
  }
  return "ready";
}

/** Permissão do navegador não prova o vínculo ADM: confere este endpoint no servidor. */
export async function adminPushState(password: string) {
  const { data, error } = await withTimeout(supabase.rpc("admin_list_push_subscriptions", { _password: password }));
  if (error) throw new Error("Não foi possível conferir os aparelhos do ADM.");
  const subscriptions = (data ?? []) as PushSubscriptionRecord[];
  let status = pushAvailability();
  let endpoint: string | null = null;
  if (status === "ready") {
    const reg = await navigator.serviceWorker.getRegistration("/sw.js");
    const sub = await reg?.pushManager.getSubscription();
    endpoint = sub?.endpoint ?? null;
    const registered = subscriptions.find((s) => s.endpoint === endpoint && (s.scope ?? "admin") === "admin");
    if (registered && Notification.permission === "granted") {
      saveBinding({ endpoint: registered.endpoint, scope: "admin" });
      status = "enabled";
    }
  }
  return { status, subscriptions, endpoint };
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
  const status = pushAvailability();
  if (status !== "ready") return status;

  const permission =
    Notification.permission === "granted" ? "granted" : await Notification.requestPermission();
  if (permission !== "granted") return "denied";

  const registration = await registerPushServiceWorker();
  await withTimeout(navigator.serviceWorker.ready);

  const existing = await registration.pushManager.getSubscription();
  const subscription =
    existing ??
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    }));

  const json = subscription.toJSON();
  const args = {
    _password: password,
    _endpoint: json.endpoint ?? subscription.endpoint,
    _p256dh: json.keys?.p256dh ?? "",
    _auth: json.keys?.auth ?? "",
    _device: detectDevice(),
  };
  let saved = await withTimeout(supabase.rpc("admin_save_push_subscription", args));
  if (saved.error || !saved.data) throw new Error("Não foi possível cadastrar este aparelho como ADM.");

  // Compatibilidade com o RPC antigo: seu upsert não muda scope='user'.
  // O ADM autenticado substitui somente o registro deste endpoint, nunca outros aparelhos.
  if (saved.data.scope === "user") {
    const { error: removeError } = await withTimeout(supabase.rpc("admin_delete_push_subscription", {
      _password: password, _id: saved.data.id,
    }));
    if (removeError) throw new Error("Não foi possível trocar o vínculo deste aparelho para ADM.");
    saved = await withTimeout(supabase.rpc("admin_save_push_subscription", args));
  }
  if (saved.error || !saved.data || (saved.data.scope ?? "admin") !== "admin") {
    localStorage.removeItem(BINDING_KEY);
    throw new Error("Vínculo ADM não confirmado. Toque em ativar novamente.");
  }
  saveBinding({ endpoint: subscription.endpoint, scope: "admin" });

  return "enabled";
}

/** Remove a inscrição deste aparelho (e do banco, se o id for informado). */
export async function disableAdminPush(password: string, id: string, endpoint: string) {
  const { error } = await withTimeout(supabase.rpc("admin_delete_push_subscription", { _password: password, _id: id }));
  if (error) throw error;
  const reg = await navigator.serviceWorker.getRegistration("/sw.js");
  const sub = await reg?.pushManager.getSubscription();
  // Remover outro celular da lista não pode desligar o celular atual.
  if (sub?.endpoint === endpoint) {
    await sub.unsubscribe();
    localStorage.removeItem(BINDING_KEY);
  }
}

export type PushDelivery = { ok: boolean; sent: number; message: string };

async function deliver(body: Record<string, unknown>): Promise<PushDelivery> {
  try {
    const { data, error } = await withTimeout(supabase.functions.invoke("notify-admin", { body }));
    if (error || data?.error) return { ok: false, sent: 0, message: "Falha no serviço de notificações. Confira a publicação da função notify-admin e a configuração de push." };
    const sent = Number(data?.sent ?? 0);
    return sent > 0
      ? { ok: true, sent, message: "Envio aceito pelo serviço de push. Confira o aparelho." }
      : { ok: false, sent: 0, message: "Nenhum aparelho recebeu o envio. Reative as notificações e tente novamente." };
  } catch {
    return { ok: false, sent: 0, message: "Não foi possível contatar o serviço de notificações." };
  }
}

/** Dispara a notificação para os aparelhos do admin. Nunca lança erro. */
export async function notifyAdmin(kind: "message" | "receipt", key: string, messageId?: string) {
  return deliver({ kind, key, messageId });
}

/** Teste remoto, autenticado e limitado ao endpoint deste celular; não é um aviso local. */
export async function testAdminPush(password: string): Promise<PushDelivery> {
  const state = await adminPushState(password);
  if (state.status !== "enabled" || !state.endpoint) {
    return { ok: false, sent: 0, message: "Vincule este aparelho ao ADM antes de testar." };
  }
  return deliver({ kind: "admin_test", password, targetEndpoint: state.endpoint });
}

const EXPIRED_NOTIFY_FLAG = "atlas_expired_delivered_v2";
const expiryPending = new Set<string>();
const expiryLastAttempt = new Map<string, number>();

export function resetExpiryNotification(key: string) {
  sessionStorage.removeItem(`${EXPIRED_NOTIFY_FLAG}:${key}`);
  expiryLastAttempt.delete(key);
}

/**
 * Autoaviso de chave expirada: envia push apenas para os aparelhos da própria chave.
 * Só confirma após envio aceito; erros/zero destinatários permitem tentar de novo.
 */
export async function notifyExpired(key: string) {
  const flag = `${EXPIRED_NOTIFY_FLAG}:${key}`;
  if (sessionStorage.getItem(flag) || expiryPending.has(key)) return;
  const lastAttempt = expiryLastAttempt.get(key);
  if (lastAttempt !== undefined && Date.now() - lastAttempt < 60_000) return;
  expiryPending.add(key);
  expiryLastAttempt.set(key, Date.now());
  try {
    const result = await deliver({ kind: "expired", key });
    if (result.ok) sessionStorage.setItem(flag, "1");
  } finally {
    expiryPending.delete(key);
  }
}

/* ---------- Notificações do usuário (chave de acesso) ---------- */

/** Cadastra este aparelho para receber avisos do suporte, atualizações e manutenção. */
export async function enableUserPush(key: string): Promise<PushStatus> {
  const status = pushAvailability();
  if (status !== "ready") return status;

  const permission =
    Notification.permission === "granted" ? "granted" : await Notification.requestPermission();
  if (permission !== "granted") return "denied";

  const registration = await registerPushServiceWorker();
  await withTimeout(navigator.serviceWorker.ready);

  const existing = await registration.pushManager.getSubscription();
  const binding = readBinding();
  if (existing && binding?.endpoint === existing.endpoint && binding.scope === "admin") return "admin-device";
  const subscription =
    existing ??
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    }));

  const json = subscription.toJSON();
  const { error } = await withTimeout(supabase.rpc("user_save_push_subscription", {
    _key: key,
    _endpoint: json.endpoint ?? subscription.endpoint,
    _p256dh: json.keys?.p256dh ?? "",
    _auth: json.keys?.auth ?? "",
    _device: detectDevice(),
  }));
  if (error) throw error;
  saveBinding({ endpoint: subscription.endpoint, scope: "user", key: key.trim().toUpperCase() });

  return "enabled";
}

/** Remove este aparelho das notificações do usuário. */
export async function disableUserPush(key: string) {
  const reg = await navigator.serviceWorker.getRegistration("/sw.js");
  const sub = await reg?.pushManager.getSubscription();
  const endpoint = sub?.endpoint;
  const binding = readBinding();
  if (binding?.scope !== "user" || binding.key !== key.trim().toUpperCase() || binding.endpoint !== endpoint) {
    throw new Error("Este aparelho não está vinculado a esta key.");
  }
  if (endpoint) {
    const { error } = await withTimeout(supabase.rpc("user_delete_push_subscription", { _key: key, _endpoint: endpoint }));
    if (error) throw error;
    await sub.unsubscribe();
    localStorage.removeItem(BINDING_KEY);
  }
}

export type UserNotifyKind = "reply" | "notice" | "update" | "maintenance" | "maintenance_end";

/**
 * Dispara notificação para os aparelhos dos usuários (somente ADM autenticado).
 * `targetKey` limita o envio a um único cliente. Nunca lança erro.
 */
export async function notifyUsers(
  password: string,
  kind: UserNotifyKind,
  options?: { targetKey?: string; body?: string },
) {
  return deliver({ kind, password, targetKey: options?.targetKey, body: options?.body });
}
