"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabase } from "@/lib/supabase-browser";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createBrowserSupabase();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<"login" | "signup">("login");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error } =
      mode === "login"
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password });

    setLoading(false);

    if (error) {
      setError(error.message);
      return;
    }

    router.push(mode === "signup" ? "/join-test-org" : "/leads");
    router.refresh();
  }

  return (
    <div style={{ maxWidth: 360, margin: "80px auto", fontFamily: "sans-serif" }}>
      <h1 style={{ marginBottom: 24 }}>AmiHub</h1>
      <form onSubmit={handleSubmit}>
        <label>E-post</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          style={inputStyle}
        />
        <label>Passord</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={6}
          style={inputStyle}
        />
        {error && <p style={{ color: "crimson" }}>{error}</p>}
        <button type="submit" disabled={loading} style={buttonStyle}>
          {loading ? "..." : mode === "login" ? "Logg inn" : "Registrer"}
        </button>
      </form>
      <button
        onClick={() => setMode(mode === "login" ? "signup" : "login")}
        style={{ marginTop: 16, background: "none", border: "none", textDecoration: "underline", cursor: "pointer" }}
      >
        {mode === "login" ? "Ny bruker? Registrer deg" : "Har allerede bruker? Logg inn"}
      </button>
    </div>
  );
}

const inputStyle: React.CSSProperties = { display: "block", width: "100%", marginBottom: 16, padding: 8 };
const buttonStyle: React.CSSProperties = { padding: "10px 20px", width: "100%" };
