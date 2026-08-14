import { createServerSupabase } from "@/lib/supabase-server";
import Link from "next/link";

const STATUS_LABEL: Record<string, string> = {
  nye: "Nye",
  under_arbeid: "Under arbeid",
  oppfolging: "For oppfølging",
  vunnet: "Kunde vunnet",
  levert: "Bil levert",
  ferdig: "Ferdig",
  tapt: "Tapt",
};

const STATUS_COLOR: Record<string, string> = {
  nye: "#5b8fc7",
  under_arbeid: "#e0a03b",
  oppfolging: "#a06fd1",
  vunnet: "#1c9c5b",
  levert: "#1c9c5b",
  ferdig: "#888",
  tapt: "#d9534f",
};

const INACTIVE_DAYS = 4;
const CONTACT_SLA_HOURS = 4;
const HANDLING_SLA_MIN = 60;

function contactSlaLevel(lead: any): "green" | "yellow" | "red" | null {
  if (!["nye", "under_arbeid"].includes(lead.status)) return null;
  const deadline = new Date(lead.created_at).getTime() + CONTACT_SLA_HOURS * 60 * 60 * 1000;
  const remainMin = (deadline - Date.now()) / 60000;
  if (remainMin <= 0) return "red";
  if (remainMin <= 60) return "yellow";
  return "green";
}

function handlingSlaLevel(lead: any): "green" | "yellow" | "red" | null {
  if (lead.status !== "under_arbeid" || !lead.accepted_at) return null;
  const deadline = new Date(lead.accepted_at).getTime() + HANDLING_SLA_MIN * 60 * 1000;
  const remainMin = (deadline - Date.now()) / 60000;
  if (remainMin <= 0) return "red";
  if (remainMin <= 15) return "yellow";
  return "green";
}

function isOldLead(lead: any): boolean {
  if (["ferdig", "tapt", "nye"].includes(lead.status)) return false;
  const ageDays = (Date.now() - new Date(lead.last_activity_at).getTime()) / 1000 / 60 / 60 / 24;
  return ageDays > INACTIVE_DAYS;
}

function needsAttention(lead: any): boolean {
  return contactSlaLevel(lead) === "red" || handlingSlaLevel(lead) === "red" || isOldLead(lead);
}

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

function LeadTable({ leads, highlight }: { leads: any[]; highlight?: boolean }) {
  if (leads.length === 0) return <p style={{ color: "#888" }}>Ingen leads her.</p>;

  return (
    <table style={{ width: "100%", borderCollapse: "collapse" }}>
      <thead>
        <tr style={{ textAlign: "left", borderBottom: "1px solid #ddd", fontSize: 13, color: "#666" }}>
          <th style={th}>Navn</th>
          <th style={th}>Avdeling</th>
          <th style={th}>Produkt</th>
          <th style={th}>Status</th>
          <th style={th}>Kontakt-SLA</th>
          <th style={th}>Behandlingsfrist</th>
          <th style={th}>Mottatt</th>
        </tr>
      </thead>
      <tbody>
        {leads.map((lead) => {
          const cSla = contactSlaLevel(lead);
          const hSla = handlingSlaLevel(lead);
          return (
            <tr
              key={lead.id}
              style={{
                borderBottom: "1px solid #eee",
                background: highlight ? "#fff5f5" : "transparent",
              }}
            >
              <td style={td}>
                <Link href={`/leads/${lead.id}`} style={{ color: "#1a1a1a", fontWeight: 600 }}>
                  {lead.first_name} {lead.last_name}
                </Link>
                {isOldLead(lead) && (
                  <div style={{ fontSize: 11, color: "#d9534f", fontWeight: 600 }}>Gammelt lead</div>
                )}
              </td>
              <td style={td}>{lead.locations?.name ?? "—"}</td>
              <td style={td}>
                {[lead.product_category, lead.product_name].filter(Boolean).join(" ") || "—"}
              </td>
              <td style={td}>
                <span
                  style={{
                    color: "#fff",
                    background: STATUS_COLOR[lead.status],
                    padding: "2px 8px",
                    borderRadius: 4,
                    fontSize: 12,
                  }}
                >
                  {STATUS_LABEL[lead.status]}
                </span>
              </td>
              <td style={td}>
                <SlaDot level={cSla} />
              </td>
              <td style={td}>
                <SlaDot level={hSla} />
              </td>
              <td style={td}>{new Date(lead.created_at).toLocaleString("nb-NO")}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function SlaDot({ level }: { level: "green" | "yellow" | "red" | null }) {
  if (!level) return <span style={{ color: "#ccc" }}>—</span>;
  const color = level === "green" ? "#1c9c5b" : level === "yellow" ? "#c98a00" : "#d13438";
  return (
    <span style={{ display: "inline-block", width: 10, height: 10, borderRadius: "50%", background: color }} />
  );
}

const th: React.CSSProperties = { padding: "8px 12px" };
const td: React.CSSProperties = { padding: "8px 12px", fontSize: 14 };
