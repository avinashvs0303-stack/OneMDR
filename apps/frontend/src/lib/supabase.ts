import { createBrowserClient } from '@supabase/ssr';

const supabaseUrl = process.env['NEXT_PUBLIC_SUPABASE_URL'] ?? '';
const supabaseAnonKey = process.env['NEXT_PUBLIC_SUPABASE_ANON_KEY'] ?? '';

/**
 * Supabase browser client — singleton for use in client components and API calls.
 *
 * Uses @supabase/ssr createBrowserClient which:
 * - Stores the session in cookies (not localStorage) — works with SSR + middleware
 * - Automatically refreshes tokens before they expire
 * - Fires onAuthStateChange events the SessionRestorer listens to
 *
 * The anon key is intentionally public — security is enforced by RLS policies.
 */
export const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey);

export const isSupabaseConfigured = supabaseUrl.length > 0 && supabaseAnonKey.length > 0;

export type { User as SupabaseUser, Session as SupabaseSession } from '@supabase/supabase-js';
