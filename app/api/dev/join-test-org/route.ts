import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase-admin";
import { createServerSupabase } from "@/lib/supabase-server";

/**
 * TEMPORARY — stand-in for the onboarding flow, which does not exist yet.
 * Links the currently logged-in auth user to the seeded "rohneselmer" test
 * organization as admin, so we can test /leads without building signup ->
 * create-org -> invite yet. Delete this route once onboarding ships.
 */
export async function POST() {
  const userSupabase = await createServerSupabase();
  const {
    data: { user },
  } = await userSupabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not logged in" }, { status: 401 });
  }

  const admin = createAdminClient();

  const { data: org, error: orgError } = await admin
    .from("organizations")
    .select("id")
    .eq("slug", "rohneselmer")
    .single();

  if (orgError || !org) {
    return NextResponse.json(
      { error: "Seed org 'rohneselmer' not found — run seed.sql first" },
      { status: 404 }
    );
  }

  const { error: upsertError } = await admin.from("users").upsert({
    id: user.id,
    organization_id: org.id,
    email: user.email,
    full_name: user.email?.split("@")[0] ?? "Test User",
    role: "admin",
  });

  if (upsertError) {
    return NextResponse.json({ error: upsertError.message }, { status: 500 });
  }

  return NextResponse.json({ status: "ok" });
}
