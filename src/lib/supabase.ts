// ============================================================
// Supabase client — used on the server side (API routes)
// The service role key bypasses Row Level Security
// ============================================================

import { createClient } from "@supabase/supabase-js";

// Browser/public client — safe to use in client components
export const supabasePublic = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Server-only admin client — never expose this to the browser
// Used in API routes and server actions only
export function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: { persistSession: false },
    }
  );
}
