import { createServerSupabase } from "@/lib/supabase-server";
import { isOldLead } from "@/lib/lead-status";
import LeadTable from "../LeadTable";

export default async function GamleLeadsPage() {
  const supabase = await createServerSupabase();
  const { data: leads, error } = await supabase
    .from("leads")
    .select("*, locations(name)")
    .not("status", "in", "(ferdig,tapt,nye)")
    .order("last_activity_at", { ascending: true });

  if (error) {
    return <p style={{ color: "crimson" }}>Feil ved henting av leads: {error.message}</p>;
  }

  const gamle = (leads ?? []).filter(isOldLead);

  return (
    <div>
      <h1 style={{ marginBottom: 8 }}>Gamle leads</h1>
      <p style={{ color: "#666", marginBottom: 24 }}>
        Leads uten aktivitet på over 4 dager. Ingen kunder skal bli glemt — sjekk denne listen jevnlig.
      </p>
      <LeadTable leads={gamle} highlight />
    </div>
  );
}
