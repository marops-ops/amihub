import { createClient } from "@supabase/supabase-js";

// Service-role client — bypasses RLS. Only ever used server-side
// (API routes / webhooks), never exposed to the browser.
export function createAdminClient() {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}
