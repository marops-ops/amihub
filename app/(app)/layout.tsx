import { redirect } from "next/navigation";
import { getCurrentUserProfile } from "@/lib/current-user";
import { signOut } from "@/lib/actions";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const profile = await getCurrentUserProfile();

  if (!profile) {
    redirect("/join-test-org");
  }

  return (
    <div style={{ display: "flex", minHeight: "100vh", fontFamily: "sans-serif" }}>
      <aside
        style={{
          width: 220,
          background: "#f5f1ea",
          padding: "24px 16px",
          borderRight: "1px solid #e5e0d8",
        }}
      >
        <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 32 }}>AmiHub</div>
        <nav style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <a href="/leads" style={navLinkStyle}>
            Leads
          </a>
          <a href="/leads/gamle" style={navLinkStyle}>
            Gamle leads
          </a>
        </nav>
        <div style={{ marginTop: 48, fontSize: 13, color: "#666" }}>
          <div>{profile.full_name}</div>
          <div>{profile.organization_name}</div>
          <div style={{ textTransform: "capitalize" }}>{profile.role}</div>
          <form action={signOut}>
            <button type="submit" style={{ marginTop: 12, fontSize: 13, textDecoration: "underline" }}>
              Logg ut
            </button>
          </form>
        </div>
      </aside>
      <main style={{ flex: 1, padding: 32 }}>{children}</main>
    </div>
  );
}

const navLinkStyle: React.CSSProperties = {
  padding: "8px 12px",
  borderRadius: 6,
  textDecoration: "none",
  color: "#1a1a1a",
  fontWeight: 500,
};
