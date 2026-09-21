/**
 * Notificações push (Web Push / VAPID) — destinatário separado por aparelho.
 * No iOS só funciona com o app adicionado à Tela de Início.
 */
import { supabase } from "@/integrations/supabase/client";
import { detectDevice } from "@/lib/device";
import { withTimeout } from "@/lib/request-timeout";
import { pushFailure, type PushDelivery } from "@/lib/push-errors";
export type { PushDelivery } from "@/lib/push-errors";

/** Chave pública VAPID — pode ficar no código (é pública por definição). */
export const VAPID_PUBLIC_KEY =
  "BOiHPKDiRjBmVRwdjAWuzJ577UoRXOz7Uq5fxMas0tzaNWVkXN98_ZDiRzC3o6rfJLzoUzN1HhKtviFFrAnvYqQ";

export type PushStatus =
  | "unsupported"
  | "ios-needs-install"
  | "denied"
  | "unknown"
  | "ready"
  | "enabled";

export type PushSubscriptionRecord = {
  id: string; endpoint: string; device: string | null; created_at: string; scope?: string | null;
};

type PushRole = "admin" | "user";

/** A prévia/desenvolvimento nunca registra push para não conflitar com o aparelho real. */
export function isPushPreviewEnvironment() {
  if (import.meta.env.DEV) return true;
  const host = window.location.hostname.toLowerCase();
  return host === "localhost" || host === "127.0.0.1" || host === "0.0.0.0" || host.includes("preview") || host.includes("lovableproject.com");
}

/** Remove inscrições criadas em uma prévia antiga. Não executa no domínio real. */
export async function cleanupPreviewPushRegistrations() {
  if (!isPushPreviewEnvironment() || !("serviceWorker" in navigator)) return;
  const registrations = await navigator.serviceWorker.getRegistrations();
  await Promise.all(registrations.filter((r) => r.scope.includes("/push/admin/") || r.scope.includes("/push/user/")).map(async (r) => {
    try {
      const sub = await r.pushManager.getSubscription();
      if (sub) await sub.unsubscribe();
    } catch { /* limpeza preventiva */ }
    await r.unregister();
  }));
}

void cleanupPreviewPushRegistrations();
const BINDING_PREFIX = "atlas_push_binding_v2";
const LEGACY_BINDING_KEY = "atlas_push_binding_v1";
const ROLE_SCOPES: Record<PushRole, string> = { admin: "/push/admin/", user: "/push/user/" };
type PushBinding = { endpoint: string; scope: "admin" | "user"; key?: string };

function readBinding(role: PushRole): PushBinding | null {
  try { return JSON.parse(localStorage.getItem(`${BINDING_PREFIX}:${role}`) ?? "null"); }
  catch { return null; }
}

function saveBinding(binding: PushBinding) {
  localStorage.setItem(`${BINDING_PREFIX}:${binding.scope}`, JSON.stringify(binding));
}

async function roleRegistration(role: PushRole) {
  const registration = await navigator.serviceWorker.getRegistration(ROLE_SCOPES[role]);
  // getRegistration também pode devolver o worker antigo da raiz. Ele não serve
  // como inscrição de um papel: ADM e usuário precisam de endpoints distintos.
  return registration?.scope === new URL(ROLE_SCOPES[role], location.origin).href ? registration : undefined;
}

async function legacySubscription() {
  const registration = await navigator.serviceWorker.getRegistration("/");
  if (registration?.scope !== new URL("/", location.origin).href) return null;
  return registration.pushManager.getSubscription();
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
  if (isPushPreviewEnvironment()) return "unsupported";
  if (!pushSupported()) return isIOS() && !isStandalone() ? "ios-needs-install" : "unsupported";
  if (isIOS() && !isStandalone()) return "ios-needs-install";
  if (Notification.permission === "denied") return "denied";
  return "ready";
}

export async function currentPushStatus(key?: string): Promise<PushStatus> {
  const available = pushAvailability();
  if (available !== "ready") return available;
  try {
    const reg = await roleRegistration("user");
    const sub = await reg?.pushManager.getSubscription();
    const binding = readBinding("user");
    if (Notification.permission !== "granted" || !sub || binding?.endpoint !== sub.endpoint) return "ready";
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
  if (isPushPreviewEnvironment()) {
    return { status: "unsupported" as PushStatus, subscriptions: [] as PushSubscriptionRecord[], endpoint: null };
  }
  const { data, error } = await withTimeout(supabase.rpc("admin_list_push_subscriptions", { _password: password }));
  if (error) throw new Error("Não foi possível conferir os aparelhos do ADM.");
  const subscriptions = (data ?? []) as PushSubscriptionRecord[];
  let status = pushAvailability();
  let endpoint: string | null = null;
  if (status === "ready") {
    const reg = await roleRegistration("admin");
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

export async function registerPushServiceWorker(role: PushRole) {
  if (isPushPreviewEnvironment()) throw new Error("Notificações desativadas na prévia. Use a versão publicada.");
  const workerUrl = role === "admin" ? "/push-admin-sw.js" : "/push-user-sw.js";
  const registration = await navigator.serviceWorker.register(workerUrl, { scope: ROLE_SCOPES[role] });
  if (registration.active) return registration;
  // navigator.serviceWorker.ready refere-se ao worker que controla a página,
  // não necessariamente ao worker deste papel. Espera o registro correto.
  let timer: ReturnType<typeof setTimeout> | undefined;
  let worker: ServiceWorker | null = null;
  let onStateChange = () => {};
  let onUpdateFound = () => {};
  try {
    await new Promise<void>((resolve, reject) => {
      onStateChange = () => {
        if (registration.active || worker?.state === "activated") resolve();
        else if (worker?.state === "redundant") reject(new Error("Não foi possível iniciar as notificações. Atualize o app."));
      };
      onUpdateFound = () => {
        worker?.removeEventListener("statechange", onStateChange);
        worker = registration.installing ?? registration.waiting;
        worker?.addEventListener("statechange", onStateChange);
        onStateChange();
      };
      registration.addEventListener("updatefound", onUpdateFound, { once: true });
      timer = setTimeout(() => reject(new Error("A ativação das notificações demorou. Tente novamente.")), 12_000);
      onUpdateFound();
    });
    return registration;
  } finally {
    clearTimeout(timer);
    registration.removeEventListener("updatefound", onUpdateFound);
    worker?.removeEventListener("statechange", onStateChange);
  }
}

/** Cadastra um único aparelho para o admin. O servidor mantém somente 1 aparelho ADM geral. */
export async function enableAdminPush(password: string): Promise<PushStatus> {
  const status = pushAvailability();
  if (status !== "ready") return status;

  const permission =
    Notification.permission === "granted" ? "granted" : await Notification.requestPermission();
  if (permission !== "granted") return "denied";

  const registration = await registerPushServiceWorker("admin");

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
    localStorage.removeItem(`${BINDING_PREFIX}:admin`);
    throw new Error("Vínculo ADM não confirmado. Toque em ativar novamente.");
  }
  saveBinding({ endpoint: subscription.endpoint, scope: "admin" });

  // Evita dois pushes no mesmo celular após atualizar o cadastro antigo.
  // Só remove a inscrição da raiz se o servidor confirmar que ela era do ADM.
  try {
    const legacy = await legacySubscription();
    if (legacy && legacy.endpoint !== subscription.endpoint) {
      const { data, error } = await withTimeout(supabase.rpc("admin_list_push_subscriptions", { _password: password }));
      const old = !error && data?.find((s) => s.endpoint === legacy.endpoint && (s.scope ?? "admin") === "admin");
      if (old) {
        const removed = await withTimeout(supabase.rpc("admin_delete_push_subscription", { _password: password, _id: old.id }));
        if (!removed.error) await legacy.unsubscribe();
      }
    }
  } catch { /* A inscrição nova já está salva; a antiga pode ser removida na lista. */ }

  return "enabled";
}

/** Remove a inscrição deste aparelho (e do banco, se o id for informado). */
export async function disableAdminPush(password: string, id: string, endpoint: string) {
  const { error } = await withTimeout(supabase.rpc("admin_delete_push_subscription", { _password: password, _id: id }));
  if (error) throw error;
  const reg = await roleRegistration("admin");
  const sub = await reg?.pushManager.getSubscription();
  // Remover outro celular da lista não pode desligar o celular atual.
  if (sub?.endpoint === endpoint) {
    await sub.unsubscribe();
    localStorage.removeItem(`${BINDING_PREFIX}:admin`);
  }
}

async function deliver(body: Record<string, unknown>): Promise<PushDelivery> {
  try {
    const { data, error } = await withTimeout(supabase.functions.invoke("notify-admin", { body }), 30_000);
    if (error || data?.error) return pushFailure(error, data);
    const sent = Number(data?.sent ?? 0);
    return sent > 0
      ? { ok: true, sent, message: Number(data?.failed ?? 0) > 0
        ? `Envio aceito para ${sent} aparelho(s); ${data.failed} envio(s) falharam.`
        : "Envio aceito pelo serviço de push. Confira o aparelho." }
      : pushFailure(null, { code: "NO_RECIPIENTS" });
  } catch {
    return pushFailure(null, { code: "NETWORK_ERROR" });
  }
}

/** Dispara a notificação para os aparelhos do admin. Nunca lança erro. */
export async function notifyAdmin(kind: "message" | "receipt", key: string, messageId?: string) {
  return deliver({ kind, key, messageId });
}

/** Teste remoto, autenticado e limitado ao endpoint deste celular; não é um aviso local. */
export async function testAdminPush(password: string): Promise<PushDelivery> {
  if (isPushPreviewEnvironment()) {
    return { ok: false, sent: 0, message: "Notificações desativadas na prévia. Use a versão publicada." };
  }
  const state = await adminPushState(password);
  if (state.status !== "enabled" || !state.endpoint) {
    return { ok: false, sent: 0, message: "Vincule este aparelho ao ADM antes de testar." };
  }
  return deliver({ kind: "admin_test", password });
}

/** Usuário só pode testar o próprio endpoint, autorizado pela própria key. */
export async function testUserPush(key: string): Promise<PushDelivery> {
  const registration = await roleRegistration("user");
  const subscription = await registration?.pushManager.getSubscription();
  if (!subscription || await currentPushStatus(key) !== "enabled") return pushFailure(null, { code: "NO_RECIPIENTS" });
  return deliver({ kind: "user_test", key, targetEndpoint: subscription.endpoint });
}

const REWARD_NOTIFY_PREFIX = "atlas_reward_ready_v1";
const rewardNotifyPending = new Set<string>();

const EXPIRED_NOTIFY_FLAG = "atlas_expired_delivered_v2";
const expiryPending = new Set<string>();
const expiryLastAttempt = new Map<string, number>();

export async function notifyRewardReady(key: string, redeemCost: number) {
  // A prévia nunca chama a Edge Function de push. A recompensa pode continuar
  // sendo consultada/coletada normalmente, mas o aviso push fica exclusivo da versão publicada.
  if (isPushPreviewEnvironment()) return;
  const normalizedKey = key.trim().toUpperCase();
  const cost = Number(redeemCost);
  if (!normalizedKey || !Number.isFinite(cost) || cost <= 0) return;
  const flag = `${REWARD_NOTIFY_PREFIX}:${normalizedKey}:${cost}`;
  const stored = Number(localStorage.getItem(flag) ?? "0");
  if (stored >= cost || rewardNotifyPending.has(flag)) return;
  rewardNotifyPending.add(flag);
  try {
    const result = await deliver({ kind: "reward_ready", key: normalizedKey });
    if (result.ok) localStorage.setItem(flag, String(cost));
  } finally {
    rewardNotifyPending.delete(flag);
  }
}

export function resetExpiryNotification(key: string) {
  sessionStorage.removeItem(`${EXPIRED_NOTIFY_FLAG}:${key}`);
  expiryLastAttempt.delete(key);
}

/**
 * Autoaviso de chave expirada: envia push apenas para os aparelhos da própria chave.
 * Só confirma após envio aceito; erros/zero destinatários permitem tentar de novo.
 */
export async function notifyExpired(key: string) {
  if (isPushPreviewEnvironment()) return;
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

/** Cadastra um único aparelho por key para receber avisos do suporte, atualizações e manutenção. */
export async function enableUserPush(key: string): Promise<PushStatus> {
  const status = pushAvailability();
  if (status !== "ready") return status;

  const permission =
    Notification.permission === "granted" ? "granted" : await Notification.requestPermission();
  if (permission !== "granted") return "denied";

  const registration = await registerPushServiceWorker("user");

  const existing = await registration.pushManager.getSubscription();
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

  // Migra somente o push antigo desta key neste navegador, preservando o ADM.
  try {
    const binding = JSON.parse(localStorage.getItem(LEGACY_BINDING_KEY) ?? "null") as PushBinding | null;
    const legacy = await legacySubscription();
    if (legacy && binding?.scope === "user" && binding.key === key.trim().toUpperCase() && binding.endpoint === legacy.endpoint) {
      const removed = await withTimeout(supabase.rpc("user_delete_push_subscription", { _key: key, _endpoint: legacy.endpoint }));
      if (!removed.error) {
        await legacy.unsubscribe();
        localStorage.removeItem(LEGACY_BINDING_KEY);
      }
    }
  } catch { /* A inscrição antiga fica disponível até poder ser removida. */ }

  return "enabled";
}

/** Remove este aparelho das notificações do usuário. */
export async function disableUserPush(key: string) {
  const reg = await roleRegistration("user");
  const sub = await reg?.pushManager.getSubscription();
  const endpoint = sub?.endpoint;
  const binding = readBinding("user");
  if (binding?.scope !== "user" || binding.key !== key.trim().toUpperCase() || binding.endpoint !== endpoint) {
    throw new Error("Este aparelho não está vinculado a esta key.");
  }
  if (endpoint) {
    const { error } = await withTimeout(supabase.rpc("user_delete_push_subscription", { _key: key, _endpoint: endpoint }));
    if (error) throw error;
    await sub.unsubscribe();
    localStorage.removeItem(`${BINDING_PREFIX}:user`);
  }
}

/** Uma nova key neste navegador não pode continuar recebendo os avisos da anterior. */
export async function retireOtherUserPush(nextKey: string) {
  const binding = readBinding("user");
  if (!binding?.key || binding.key === nextKey.trim().toUpperCase()) return;
  const registration = await roleRegistration("user");
  const subscription = await registration?.pushManager.getSubscription();
  if (subscription?.endpoint === binding.endpoint) await subscription.unsubscribe();
  // O endpoint antigo não recebe mais push no navegador mesmo se a limpeza no banco falhar.
  localStorage.removeItem(`${BINDING_PREFIX}:user`);
  try {
    await withTimeout(supabase.rpc("user_delete_push_subscription", { _key: binding.key, _endpoint: binding.endpoint }));
  } catch { /* Endpoints revogados também são limpos pelo servidor ao retornar 410. */ }
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
