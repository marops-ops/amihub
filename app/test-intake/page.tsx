"use client";

import { useState } from "react";

export default function TestIntakePage() {
  const [orgSlug, setOrgSlug] = useState("rohneselmer");
  const [locationName, setLocationName] = useState("Oslo");
  const [message, setMessage] = useState("Jeg vil gjerne prøvekjøre denne");
  const [productCategory, setProductCategory] = useState("Ford");
  const [productName, setProductName] = useState("Explorer");
  const [result, setResult] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit() {
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/leads/intake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organization_slug: orgSlug,
          source: "manual",
          payload: {
            first_name: "Test",
            last_name: "Testesen",
            email: "test@example.com",
            phone: "12345678",
            message,
            location_name: locationName,
            product_category: productCategory,
            product_name: productName,
            marketing_consent: true,
          },
        }),
      });
      const data = await res.json();
      setResult(JSON.stringify(data, null, 2));
    } catch (e) {
      setResult(String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: 480, margin: "40px auto", fontFamily: "sans-serif" }}>
      <h1>Test lead intake</h1>
      <label>Organization slug</label>
      <input value={orgSlug} onChange={(e) => setOrgSlug(e.target.value)} style={inputStyle} />
      <label>Forhandler (location name)</label>
      <input value={locationName} onChange={(e) => setLocationName(e.target.value)} style={inputStyle} />
      <label>Bilmerke</label>
      <input value={productCategory} onChange={(e) => setProductCategory(e.target.value)} style={inputStyle} />
      <label>Modell</label>
      <input value={productName} onChange={(e) => setProductName(e.target.value)} style={inputStyle} />
      <label>Spørsmål</label>
      <textarea value={message} onChange={(e) => setMessage(e.target.value)} style={{ ...inputStyle, height: 80 }} />
      <button onClick={submit} disabled={loading} style={{ marginTop: 12, padding: "8px 16px" }}>
        {loading ? "Sender..." : "Send test-lead"}
      </button>
      {result && (
        <pre style={{ background: "#111", color: "#0f0", padding: 12, marginTop: 16, whiteSpace: "pre-wrap" }}>
          {result}
        </pre>
      )}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  display: "block",
  width: "100%",
  marginBottom: 12,
  padding: 8,
};
