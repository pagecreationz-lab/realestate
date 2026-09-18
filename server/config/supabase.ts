import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { env } from './env.js';

let adminClient: SupabaseClient | undefined;

export function getSupabaseAdmin() {
  if (!env.supabaseUrl || !env.supabaseSecretKey) {
    throw new Error(
      'Supabase is not configured. Set SUPABASE_URL and SUPABASE_SECRET_KEY.',
    );
  }

  adminClient ??= createClient(env.supabaseUrl, env.supabaseSecretKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  return adminClient;
}
