import "./globals.css";
import { getSession } from "@/lib/getSession";
import { prisma } from "@/lib/prisma";
import { logout } from "./login/actions";
import { SidebarNav } from "@/components/SidebarNav";
import { MobileNav } from "@/components/MobileNav";

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
  const user = session ? await prisma.user.findUnique({ where: { id: session.userId }, select: { photoUrl: true } }) : null;
  const photoUrl = user?.photoUrl ?? null;

  return (
    <html lang="en">
      <body>
        {session ? (
          // Logged in: sidebar + content on desktop, hamburger + drawer on
          // mobile. Both read from the same session, so they can never show
          // different information. The login page never reaches this branch
          // because there's no session yet when it's rendered.
          <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
            <MobileNav userName={session.name} userRole={session.role} photoUrl={photoUrl} logoutAction={logout} />
            <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
              <aside
                className="desktop-sidebar"
                style={{
                  width: 220,
                  flexShrink: 0,
                  background: "var(--pitch)",
                  color: "#fff",
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
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                    {photoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={photoUrl}
                        alt={session.name}
                        style={{ width: 36, height: 36, borderRadius: "50%", objectFit: "cover", border: "2px solid rgba(255,255,255,0.3)" }}
                      />
                    ) : (
                      <div
                        style={{
                          width: 36,
                          height: 36,
                          borderRadius: "50%",
                          background: "var(--turf)",
                          color: "#fff",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: 16,
                          fontWeight: 800,
                        }}
                      >
                        {session.name.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700 }}>{session.name}</div>
                      <div style={{ fontSize: 11, opacity: 0.7 }}>{session.role.replace("_", " ")}</div>
                    </div>
                  </div>
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
          </div>
        ) : (
          children
        )}
      </body>
    </html>
  );
}
