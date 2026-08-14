import Link from "next/link";
import { STATUS_LABEL, STATUS_COLOR, contactSlaLevel, handlingSlaLevel, isOldLead } from "@/lib/lead-status";

export default function LeadTable({ leads, highlight }: { leads: any[]; highlight?: boolean }) {
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
