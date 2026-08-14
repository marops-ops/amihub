"use client";

import { useState, useTransition } from "react";
import { reassignLead } from "@/lib/actions";

const REASONS = ["Ferie", "Sykdom", "Feilfordeling", "Endret ansvarsområde", "Annet"];

export default function ReassignBox({
  leadId,
  sellers,
}: {
  leadId: string;
  sellers: { id: string; full_name: string }[];
}) {
  const [isPending, startTransition] = useTransition();
  const [selectedSeller, setSelectedSeller] = useState(sellers[0]?.id ?? "");
  const [reason, setReason] = useState(REASONS[0]);
  const [message, setMessage] = useState<string | null>(null);

  if (sellers.length === 0) return null;

  function submit() {
    startTransition(async () => {
      const result = await reassignLead(leadId, selectedSeller, reason);
      setMessage(result.error ? `Feil: ${result.error}` : "Lead omfordelt");
    });
  }

  return (
    <div style={{ background: "#eef4ff", padding: 16, borderRadius: 6, marginTop: 20 }}>
      <strong>Omfordel lead (salgsleder/admin)</strong>
      <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
        <select value={selectedSeller} onChange={(e) => setSelectedSeller(e.target.value)}>
          {sellers.map((s) => (
            <option key={s.id} value={s.id}>
              {s.full_name}
            </option>
          ))}
        </select>
        <select value={reason} onChange={(e) => setReason(e.target.value)}>
          {REASONS.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
        <button onClick={submit} disabled={isPending} style={{ padding: "8px 16px", cursor: "pointer" }}>
          Omfordel
        </button>
      </div>
      {message && <p style={{ marginTop: 8, fontSize: 13 }}>{message}</p>}
    </div>
  );
}
