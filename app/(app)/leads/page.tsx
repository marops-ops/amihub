import { createServerSupabase } from "@/lib/supabase-server";
import { needsAttention } from "@/lib/lead-status";
import LeadTable from "./LeadTable";

export default async function LeadsPage() {
  const supabase = await createServerSupabase();
  const { data: leads, error } = await supabase
    .from("leads")
    .select("*, locations(name)")
    .not("status", "in", "(ferdig,tapt)")
    .order("created_at", { ascending: false });

  if (error) {
    return <p style={{ color: "crimson" }}>Feil ved henting av leads: {error.message}</p>;
  }

  const attention = (leads ?? []).filter(needsAttention);
  const rest = (leads ?? []).filter((l) => !needsAttention(l));

  return (
    <div>
      <h1 style={{ marginBottom: 24 }}>Leads</h1>

      {attention.length > 0 && (
        <section style={{ marginBottom: 32 }}>
          <h2 style={{ color: "#d9534f", fontSize: 16, marginBottom: 8 }}>
            Krever handling ({attention.length})
          </h2>
          <LeadTable leads={attention} highlight />
        </section>
      )}

      <section>
        <h2 style={{ fontSize: 16, marginBottom: 8 }}>Aktive leads ({rest.length})</h2>
        <LeadTable leads={rest} />
      </section>
    </div>
  );
}
