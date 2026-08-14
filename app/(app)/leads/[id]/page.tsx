import { createServerSupabase } from "@/lib/supabase-server";
import { getCurrentUserProfile } from "@/lib/current-user";
import { notFound } from "next/navigation";
import LeadActions from "./LeadActions";
import ReassignBox from "./ReassignBox";

const STATUS_LABEL: Record<string, string> = {
  nye: "Nye",
  under_arbeid: "Under arbeid",
  oppfolging: "For oppfølging",
  vunnet: "Kunde vunnet",
  levert: "Bil levert",
  ferdig: "Ferdig",
  tapt: "Tapt",
};

export default async function LeadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createServerSupabase();

  const { data: lead, error } = await supabase
    .from("leads")
    .select("*, locations(name)")
    .eq("id", id)
    .single();

  if (error || !lead) notFound();

  const { data: activities } = await supabase
    .from("lead_activities")
    .select("*, users(full_name)")
    .eq("lead_id", id)
    .order("created_at", { ascending: false });

  const { data: notes } = await supabase
    .from("lead_notes")
    .select("*, users(full_name)")
    .eq("lead_id", id)
    .order("created_at", { ascending: false });

  const profile = await getCurrentUserProfile();
  let sellers: { id: string; full_name: string }[] = [];
  if (profile && ["admin", "salgsleder"].includes(profile.role) && lead.location_id) {
    const { data: userLocations } = await supabase
      .from("user_locations")
      .select("users(id, full_name, role)")
      .eq("location_id", lead.location_id);
    sellers = (userLocations ?? [])
      .map((ul: any) => ul.users)
      .filter((u: any) => u && u.role === "selger");
  }

  return (
    <div style={{ display: "flex", gap: 32 }}>
      <div style={{ flex: 2 }}>
        <h1>
          {lead.first_name} {lead.last_name}
        </h1>
        <p style={{ color: "#666" }}>
          {lead.locations?.name} · {[lead.product_category, lead.product_name].filter(Boolean).join(" ")} ·{" "}
          {STATUS_LABEL[lead.status]}
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, margin: "16px 0" }}>
          <Info label="E-post" value={lead.email} />
          <Info label="Telefon" value={lead.phone} />
          <Info label="Kilde" value={lead.source_channel} />
          <Info label="Mottatt" value={new Date(lead.created_at).toLocaleString("nb-NO")} />
          {lead.lost_type && <Info label="Tapt årsak" value={`${lead.lost_type}: ${lead.lost_reason}`} />}
          {lead.delivery_date && (
            <Info label="Utleveringsdato" value={new Date(lead.delivery_date).toLocaleDateString("nb-NO")} />
          )}
        </div>

        {lead.message && (
          <div style={{ background: "#f5f1ea", padding: 12, borderRadius: 6, margin: "16px 0" }}>
            <strong>Melding fra kunde:</strong>
            <p>{lead.message}</p>
          </div>
        )}

        <LeadActions
          leadId={lead.id}
          status={lead.status}
          subStatus={lead.sub_status}
          productCategory={lead.product_category}
        />

        {profile && ["admin", "salgsleder"].includes(profile.role) && (
          <ReassignBox leadId={lead.id} sellers={sellers} />
        )}

        <h3 style={{ marginTop: 32 }}>Notater</h3>
        <ul style={{ listStyle: "none", padding: 0 }}>
          {(notes ?? []).map((n) => (
            <li key={n.id} style={{ borderBottom: "1px solid #eee", padding: "8px 0", fontSize: 14 }}>
              <strong>{n.users?.full_name ?? "Ukjent"}</strong> —{" "}
              {new Date(n.created_at).toLocaleString("nb-NO")}
              <div>{n.note}</div>
            </li>
          ))}
        </ul>

        <h3 style={{ marginTop: 32 }}>Aktivitetslogg</h3>
        <ul style={{ listStyle: "none", padding: 0 }}>
          {(activities ?? []).map((a) => (
            <li key={a.id} style={{ borderBottom: "1px solid #eee", padding: "8px 0", fontSize: 14 }}>
              <strong>{a.activity_type}</strong> — {a.users?.full_name ?? "System"} —{" "}
              {new Date(a.created_at).toLocaleString("nb-NO")}
              {a.note && <div style={{ color: "#666" }}>{a.note}</div>}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <div style={{ fontSize: 12, color: "#888" }}>{label}</div>
      <div>{value ?? "—"}</div>
    </div>
  );
}
