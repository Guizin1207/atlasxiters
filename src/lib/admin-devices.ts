import { supabase } from "@/integrations/supabase/client";
import { detectDevice } from "@/lib/device";
import { withTimeout } from "@/lib/request-timeout";

const SESSION_ID = "atlas_admin_access_session";
export type AdminAccessSession = {
  session_id: string; device_id: string | null; device_label: string;
  created_at: string; last_seen_at: string; ended_at: string | null;
};
export function currentAdminSessionId(): string | null { return sessionStorage.getItem(SESSION_ID); }
export function beginAdminSession(): void { sessionStorage.setItem(SESSION_ID, crypto.randomUUID()); }
export async function touchAdminSession(password: string): Promise<void> {
  let id = currentAdminSessionId();
  if (!id) { beginAdminSession(); id = currentAdminSessionId(); }
  let deviceId = localStorage.getItem("atlas_vip_device_id");
  if (!deviceId) { deviceId = crypto.randomUUID(); localStorage.setItem("atlas_vip_device_id", deviceId); }
  const ua = navigator.userAgent;
  const browser = /Edg/i.test(ua) ? "Edge" : /OPR|Opera/i.test(ua) ? "Opera" : /Firefox|FxiOS/i.test(ua) ? "Firefox" : /Chrome|CriOS/i.test(ua) ? "Chrome" : /Safari/i.test(ua) ? "Safari" : "Navegador";
  const { error } = await withTimeout(supabase.rpc("admin_touch_access_session", {
    _password: password, _session_id: id!, _device_id: deviceId, _device_label: `${detectDevice()} · ${browser}`,
  }));
  if (error) throw new Error("admin_device_registry_unavailable");
}
export async function endAdminSession(password: string): Promise<void> {
  const id = currentAdminSessionId();
  sessionStorage.removeItem(SESSION_ID);
  if (!id) return;
  await withTimeout(supabase.rpc("admin_end_access_session", { _password: password, _session_id: id }));
}
export async function listAdminSessions(password: string): Promise<AdminAccessSession[]> {
  const { data, error } = await withTimeout(supabase.rpc("admin_list_access_sessions", { _password: password }));
  if (error || !Array.isArray(data)) throw new Error("admin_device_registry_unavailable");
  return data as unknown as AdminAccessSession[];
}
