// Single guard for whether Supabase is wired up. When either env var is missing
// the whole auth/stats layer stays dormant and the app behaves exactly like the
// guest-only Phase 1 build. Every Supabase code path must check this first.

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

export function isSupabaseConfigured(): boolean {
  return SUPABASE_URL.length > 0 && SUPABASE_ANON_KEY.length > 0;
}
