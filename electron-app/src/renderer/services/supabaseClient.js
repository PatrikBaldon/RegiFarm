import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

if (!isSupabaseConfigured) {
  // Supabase non configurato - funzionalità limitate
}

export const supabase = isSupabaseConfigured
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: true, // Abilita persistenza sessione in localStorage
        autoRefreshToken: true, // Abilita refresh automatico del token
        storage: typeof window !== 'undefined' ? window.localStorage : undefined,
      },
    })
  : null;
