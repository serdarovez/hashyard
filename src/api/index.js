import { createClient } from '@supabase/supabase-js';
import { createLiveApi } from './live.js';
import { createDemoApi } from './demo.js';

/**
 * Picks the backend. With VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY set
 * (in .env locally, or in Vercel's environment variables) the site talks to
 * Supabase. Without them it runs the in-memory demo, so a fresh clone or a
 * preview deploy still works.
 *
 * The anon key is safe to ship to browsers: it only grants what the row level
 * security rules in supabase/migrations allow.
 */
const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const LIVE = Boolean(url && key);

export const api = LIVE
  ? createLiveApi(createClient(url, key, {
      // PKCE returns ?code= in the query string. The implicit flow would put
      // tokens in the #hash, which is where this site keeps its routes.
      auth: { flowType: 'pkce', detectSessionInUrl: true, persistSession: true }
    }))
  : createDemoApi();
