import { createServerSupabase } from "@/lib/supabase-server";

export interface CurrentUserProfile {
  id: string;
  email: string;
  full_name: string;
  role: "admin" | "selger" | "salgsleder";
  organization_id: string;
  organization_name: string;
}

export async function getCurrentUserProfile(): Promise<CurrentUserProfile | null> {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("users")
    .select("id, email, full_name, role, organization_id, organizations(name)")
    .eq("id", user.id)
    .single();

  if (error || !data) return null;

  return {
    id: data.id,
    email: data.email,
    full_name: data.full_name,
    role: data.role,
    organization_id: data.organization_id,
    organization_name: (data.organizations as any)?.name ?? "",
  };
}
