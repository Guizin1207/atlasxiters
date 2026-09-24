// Supabase client configuration.
import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

// O Atlas usa um único projeto Supabase. Mantemos um fallback público para evitar
// que uma configuração antiga do Lovable/Vite aponte o app para outro projeto.
const ATLAS_SUPABASE_URL = "https://abgrbidxhssmjqdeddpk.supabase.co";
const ATLAS_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_g7ez7PF_3doMKk57vrbT7A_qWVOZ9b_";
const configuredUrl = String(import.meta.env.VITE_SUPABASE_URL ?? "").trim();
const configuredKey = String(import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? "").trim();
const SUPABASE_URL = configuredUrl === ATLAS_SUPABASE_URL ? configuredUrl : ATLAS_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = configuredUrl === ATLAS_SUPABASE_URL && configuredKey ? configuredKey : ATLAS_SUPABASE_PUBLISHABLE_KEY;

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: typeof window !== 'undefined' ? window.localStorage : undefined,
  },
});
