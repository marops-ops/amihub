import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// User-context client — respects RLS based on the logged-in user's session.
// Use this everywhere EXCEPT the intake webhook (which needs the admin client
// to write across tenants without a logged-in user).
export async function createServerSupabase() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Called from a Server Component — middleware handles refresh instead.
          }
        },
      },
    }
  );
}
