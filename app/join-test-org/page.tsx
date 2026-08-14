"use client";

export const dynamic = "force-dynamic";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function JoinTestOrgPage() {
  const router = useRouter();
  const [status, setStatus] = useState<string | null>(null);

  async function join() {
    setStatus("Kobler til...");
    const res = await fetch("/api/dev/join-test-org", { method: "POST" });
    const data = await res.json();
    if (!res.ok) {
      setStatus(`Feil: ${data.error}`);
      return;
    }
    router.push("/leads");
  }

  return (
    <div style={{ maxWidth: 480, margin: "80px auto", fontFamily: "sans-serif" }}>
      <h1>Midlertidig test-oppsett</h1>
      <p style={{ color: "#666" }}>
        Onboarding-flowen er ikke bygget ennå. Denne siden kobler deg til
        test-organisasjonen «RøhneSelmer» som admin, slik at du kan teste
        lead-håndtering. Denne siden fjernes når ordentlig onboarding er på plass.
      </p>
      <button onClick={join} style={{ padding: "10px 20px", marginTop: 16 }}>
        Bli admin for RøhneSelmer (test)
      </button>
      {status && <p>{status}</p>}
    </div>
  );
}
