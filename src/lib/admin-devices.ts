import { supabase } from "@/integrations/supabase/client";
import { detectDevice } from "@/lib/device";
import { withTimeout } from "@/lib/request-timeout";

const SESSION_ID = "atlas_admin_access_session";
const DEVICE_ID = "atlas_vip_device_id";

export type AdminAccessSession = {
  session_id: string;
  device_id: string | null;
  device_label: string;
  created_at: string;
  last_seen_at: string;
  ended_at: string | null;
  approval_status?: "pending" | "approved" | "denied";
  is_primary?: boolean;
  approved_at?: string | null;
  approved_by_device_id?: string | null;
};

export function currentAdminSessionId(): string | null {
  return sessionStorage.getItem(SESSION_ID);
}

export function currentAdminDeviceId(): string | null {
  return localStorage.getItem(DEVICE_ID);
}

export function ensureAdminDeviceId(): string {
  return getOrCreateDeviceId();
}

export async function checkAdminDeviceAccess(password: string): Promise<"approved" | "pending" | "denied"> {
  const deviceId = getOrCreateDeviceId();
  const { data, error } = await withTimeout(supabase.rpc("admin_check_device_access", {
    _password: password,
    _device_id: deviceId,
    _device_label: `${detectDevice()} · ${browserName(navigator.userAgent)}`,
  }));
  if (error || !["approved", "pending", "denied"].includes(String(data))) throw new Error("admin_device_approval_unavailable");
  return data as "approved" | "pending" | "denied";
}

export async function recoverAdminPrimaryDevice(password: string): Promise<boolean> {
  const deviceId = getOrCreateDeviceId();
  const { data, error } = await withTimeout(supabase.rpc("admin_recover_primary_device", {
    _password: password,
    _device_id: deviceId,
    _device_label: `${detectDevice()} · ${browserName(navigator.userAgent)}`,
  }));
  if (error || data !== true) throw new Error("admin_recovery_failed");
  return true;
}

export async function setAdminDeviceApproval(password: string, deviceId: string, approved: boolean): Promise<boolean> {
  const currentDeviceId = getOrCreateDeviceId();
  const { data, error } = await withTimeout(supabase.rpc("admin_set_device_approval", {
    _password: password, _current_device_id: currentDeviceId, _device_id: deviceId, _approved: approved,
  }));
  if (error || data !== true) throw new Error("admin_device_approval_failed");
  return true;
}

export function beginAdminSession(): void {
  sessionStorage.setItem(SESSION_ID, crypto.randomUUID());
}

function getOrCreateDeviceId(): string {
  let deviceId = localStorage.getItem(DEVICE_ID);
  if (!deviceId) {
    deviceId = crypto.randomUUID();
    localStorage.setItem(DEVICE_ID, deviceId);
  }
  return deviceId;
}

function browserName(ua: string): string {
  if (/Edg/i.test(ua)) return "Edge";
  if (/OPR|Opera/i.test(ua)) return "Opera";
  if (/Firefox|FxiOS/i.test(ua)) return "Firefox";
  if (/Chrome|CriOS/i.test(ua)) return "Chrome";
  if (/Safari/i.test(ua)) return "Safari";
  return "Navegador";
}

export async function touchAdminSession(password: string): Promise<void> {
  let id = currentAdminSessionId();
  if (!id) {
    beginAdminSession();
    id = currentAdminSessionId();
  }

  const deviceId = getOrCreateDeviceId();
  const { error } = await withTimeout(supabase.rpc("admin_touch_access_session", {
    _password: password,
    _session_id: id!,
    _device_id: deviceId,
    _device_label: `${detectDevice()} · ${browserName(navigator.userAgent)}`,
  }));

  if (error) throw new Error("admin_device_registry_unavailable");
}

export async function endAdminSession(password: string): Promise<void> {
  const id = currentAdminSessionId();
  sessionStorage.removeItem(SESSION_ID);
  if (!id) return;

  await withTimeout(supabase.rpc("admin_end_access_session", {
    _password: password,
    _session_id: id,
  }));
}

export async function listAdminSessions(password: string): Promise<AdminAccessSession[]> {
  const { data, error } = await withTimeout(
    supabase.rpc("admin_list_access_sessions", { _password: password })
  );

  if (error || !Array.isArray(data)) {
    throw new Error("admin_device_registry_unavailable");
  }

  return data as unknown as AdminAccessSession[];
}

export async function clearAdminDevices(password: string): Promise<number> {
  const { data, error } = await withTimeout(
    supabase.rpc("admin_clear_access_devices", {
      _password: password,
      _current_device_id: getOrCreateDeviceId(),
    })
  );

  if (error || typeof data !== "number") {
    throw new Error("admin_device_registry_unavailable");
  }

  return data;
}
