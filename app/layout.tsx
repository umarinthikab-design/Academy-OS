import "./globals.css";
import { getSession } from "@/lib/getSession";
import { logout } from "./login/actions";
import { SidebarNav } from "@/components/SidebarNav";

export const metadata = {
  title: "Touchline",
  description: "Grassroots coaching management",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();

  return (
    <html lang="en">
      <body>
        {session ? (
          // Logged in: sidebar + content. The login page never reaches this
          // branch because there's no session yet when it's rendered.
          <div style={{ display: "flex", minHeight: "100vh" }}>
            <aside
              style={{
                width: 220,
                flexShrink: 0,
                background: "var(--pitch)",
                color: "#fff",
                display: "flex",
                flexDirection: "column",
                padding: "20px 0",
                position: "sticky",
                top: 0,
                height: "100vh",
              }}
            >
              <div style={{ padding: "0 20px 20px" }}>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", opacity: 0.7 }}>
                  GRASSROOTS COACHING
                </div>
                <div style={{ fontSize: 22, fontWeight: 800, textTransform: "uppercase" }}>Touchline</div>
              </div>

              <SidebarNav />

              <div style={{ padding: "16px 20px 0", borderTop: "1px solid rgba(255,255,255,0.15)", marginTop: 12 }}>
                <div style={{ fontSize: 13, fontWeight: 700 }}>{session.name}</div>
                <div style={{ fontSize: 11, opacity: 0.7, marginBottom: 10 }}>{session.role.replace("_", " ")}</div>
                <form action={logout}>
                  <button
                    type="submit"
                    style={{
                      width: "100%",
                      padding: "6px 10px",
                      background: "rgba(255,255,255,0.1)",
                      color: "#fff",
                      border: "1px solid rgba(255,255,255,0.3)",
                      borderRadius: 6,
                      cursor: "pointer",
                      fontSize: 12,
                    }}
                  >
                    Sign out
                  </button>
                </form>
              </div>
            </aside>
            <main style={{ flex: 1, minWidth: 0 }}>{children}</main>
          </div>
        ) : (
          children
        )}
      </body>
    </html>
  );
}
