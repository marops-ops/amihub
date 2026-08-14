"use client";

import { useState, useTransition } from "react";
import {
  acceptLead,
  setIkkeAktuelt,
  setTilbudGitt,
  setProvekjoringBooket,
  resetKundeAvventer,
  setKundeAvslattTilbud,
  setKontraktSkrevet,
  setNyUtleveringsdato,
  markLevert,
  registrerOppfolgingssamtale,
  addNote,
} from "@/lib/actions";
import { IKKE_AKTUELT_REASONS, KUNDE_AVSLATT_REASONS } from "@/lib/reasons";

const BRAND_HINTS: Record<string, string> = {
  Ford: "Husk å booke kunden inn i TDS på riktig modell.",
  Renault: "Denne lokasjonen følger egen bookingrutine.",
  Dacia: "Denne lokasjonen følger egen bookingrutine.",
  Alpine: "Denne lokasjonen følger egen bookingrutine.",
};

export default function LeadActions({
  leadId,
  status,
  subStatus,
  productCategory,
}: {
  leadId: string;
  status: string;
  subStatus: string | null;
  productCategory: string | null;
}) {
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [noteText, setNoteText] = useState("");
  const [ikkeAktueltReason, setIkkeAktueltReason] = useState<string>(IKKE_AKTUELT_REASONS[0]);
  const [avslattReason, setAvslattReason] = useState<string>(KUNDE_AVSLATT_REASONS[0]);
  const [showProvekjoringHint, setShowProvekjoringHint] = useState(false);
  const [deliveryDate, setDeliveryDate] = useState("");
  const [showLeveringNei, setShowLeveringNei] = useState(false);

  function run(action: () => Promise<{ success?: boolean; error?: string }>) {
    startTransition(async () => {
      const result = await action();
      setMessage(result.error ? `Feil: ${result.error}` : "Lagret");
    });
  }

  return (
    <div style={{ background: "#fafafa", padding: 16, borderRadius: 6 }}>
      {status === "nye" && (
        <button onClick={() => run(() => acceptLead(leadId))} disabled={isPending} style={btnPrimary}>
          Aksepter Lead
        </button>
      )}

      {status === "under_arbeid" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <strong>Ikke aktuelt</strong>
            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
              <select value={ikkeAktueltReason} onChange={(e) => setIkkeAktueltReason(e.target.value)}>
                {IKKE_AKTUELT_REASONS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
              <button onClick={() => run(() => setIkkeAktuelt(leadId, ikkeAktueltReason))} disabled={isPending} style={btnDanger}>
                Bekreft – avslutt lead
              </button>
            </div>
          </div>

          <button onClick={() => run(() => setTilbudGitt(leadId))} disabled={isPending} style={btnPrimary}>
            Tilbud gitt
          </button>

          <div>
            {!showProvekjoringHint ? (
              <button onClick={() => setShowProvekjoringHint(true)} style={btnPrimary}>
                Prøvekjøring booket
              </button>
            ) : (
              <div style={{ background: "#eef4ff", padding: 12, borderRadius: 6 }}>
                <strong>HUSK</strong>
                <p style={{ fontSize: 13 }}>
                  {BRAND_HINTS[productCategory ?? ""] ?? "Følg lokal bookingrutine."}
                </p>
                <button onClick={() => run(() => setProvekjoringBooket(leadId))} disabled={isPending} style={btnPrimary}>
                  Bekreft booking
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {status === "oppfolging" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <strong>Kontrakt skrevet</strong>
            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
              <input type="date" value={deliveryDate} onChange={(e) => setDeliveryDate(e.target.value)} />
              <button
                onClick={() => run(() => setKontraktSkrevet(leadId, new Date(deliveryDate + "T12:00:00").toISOString()))}
                disabled={isPending || !deliveryDate}
                style={btnPrimary}
              >
                Lagre og flytt til Kunde vunnet
              </button>
            </div>
          </div>

          <button onClick={() => run(() => resetKundeAvventer(leadId))} disabled={isPending} style={btnOutline}>
            Kunde avventer (nullstill varsel-syklus)
          </button>

          <div>
            <strong>Kunde avslått tilbud</strong>
            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
              <select value={avslattReason} onChange={(e) => setAvslattReason(e.target.value)}>
                {KUNDE_AVSLATT_REASONS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
              <button onClick={() => run(() => setKundeAvslattTilbud(leadId, avslattReason))} disabled={isPending} style={btnDanger}>
                Bekreft
              </button>
            </div>
          </div>
        </div>
      )}

      {status === "vunnet" && (
        <div>
          <strong>Er bilen levert?</strong>
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <button onClick={() => setShowLeveringNei(true)} style={btnOutline}>
              Nei
            </button>
            <button onClick={() => run(() => markLevert(leadId))} disabled={isPending} style={btnPrimary}>
              Ja
            </button>
          </div>
          {showLeveringNei && (
            <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
              <input type="date" value={deliveryDate} onChange={(e) => setDeliveryDate(e.target.value)} />
              <button
                onClick={() => run(() => setNyUtleveringsdato(leadId, new Date(deliveryDate + "T12:00:00").toISOString()))}
                disabled={isPending || !deliveryDate}
                style={btnPrimary}
              >
                Oppdater dato
              </button>
            </div>
          )}
        </div>
      )}

      {status === "levert" && (
        <button onClick={() => run(() => registrerOppfolgingssamtale(leadId))} disabled={isPending} style={btnPrimary}>
          Registrer oppfølgingssamtale
        </button>
      )}

      {["ferdig", "tapt"].includes(status) && (
        <p style={{ color: "#666" }}>Leadet er avsluttet. Ingen flere handlinger tilgjengelig.</p>
      )}

      <div style={{ marginTop: 20, borderTop: "1px solid #ddd", paddingTop: 16 }}>
        <strong>Legg til notat</strong>
        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
          <input
            placeholder="Skriv notat..."
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            style={{ flex: 1, padding: 6 }}
          />
          <button
            onClick={() =>
              startTransition(async () => {
                const result = await addNote(leadId, noteText);
                setMessage(result.error ? `Feil: ${result.error}` : "Notat lagret");
                if (result.success) setNoteText("");
              })
            }
            disabled={isPending || !noteText.trim()}
            style={btnOutline}
          >
            Legg til
          </button>
        </div>
      </div>

      {message && <p style={{ marginTop: 12, fontSize: 13 }}>{message}</p>}
    </div>
  );
}

const btnPrimary: React.CSSProperties = { padding: "8px 16px", cursor: "pointer", background: "#FD5901", color: "#fff", border: "none", borderRadius: 6, fontWeight: 600 };
const btnOutline: React.CSSProperties = { padding: "8px 16px", cursor: "pointer", background: "#fff", border: "1px solid #ccc", borderRadius: 6 };
const btnDanger: React.CSSProperties = { padding: "8px 16px", cursor: "pointer", background: "#d13438", color: "#fff", border: "none", borderRadius: 6, fontWeight: 600 };
