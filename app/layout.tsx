import "./globals.css";
import { getSession } from "@/lib/getSession";
import { prisma } from "@/lib/prisma";
import { getPermissions } from "@/lib/permissions";
import { getAcademyBranding } from "@/lib/getAcademyBranding";
import { logout } from "./login/actions";
import { SidebarNav } from "@/components/SidebarNav";
import { MobileNav } from "@/components/MobileNav";
import { Avatar } from "@/components/ui/Avatar";
import { Icon } from "@/components/ui/Icon";
import { roleLabel } from "@/lib/roleLabel";
import { getNavItems } from "@/lib/navItems";
import { getRequestsBadge } from "@/lib/approvals";
import { ServiceWorkerRegister } from "@/components/ServiceWorkerRegister";
import { InstallPrompt } from "@/components/InstallPrompt";
import { DevAccountSwitcher } from "@/components/DevAccountSwitcher";
import Link from "next/link";
import type { Metadata, Viewport } from "next";

export async function generateMetadata(): Promise<Metadata> {
  const { academyName } = await getAcademyBranding();
  return {
    title: academyName,
    description: "Professional football coaching management",
    applicationName: academyName,
    appleWebApp: {
      capable: true,
      statusBarStyle: "default",
      title: academyName,
    },
    icons: {
      apple: "/apple-touch-icon.png",
      icon: [{ url: "/icon-192.png", sizes: "192x192", type: "image/png" }, { url: "/icon-512.png", sizes: "512x512", type: "image/png" }],
    },
  };
}

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#0b3d2e" },
    { media: "(prefers-color-scheme: dark)", color: "#0a1813" },
  ],
};

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

// Top header: page-context breadcrumb handled per-page; this shell provides
// the consistent header strip with the Touchline wordmark, date/greeting, and
// the user's profile chip linking to Settings.
function TopHeader({ name, role, photoUrl }: { name: string; role: string; photoUrl: string | null }) {
  return (
    <header
      style={{
        height: 60,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 16,
        padding: "0 28px",
        background: "var(--surface)",
        borderBottom: "1px solid var(--border)",
        position: "sticky",
        top: 0,
        zIndex: 20,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, color: "var(--text-muted)" }}>
        <Icon name="calendar" size={16} style={{ color: "var(--secondary)" }} />
        {new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
      </div>
      <Link
        href="/settings"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          textDecoration: "none",
          color: "var(--text)",
          padding: "5px 10px",
          borderRadius: 8,
          transition: "background var(--transition)",
        }}
      >
        <Avatar name={name} src={photoUrl} size={32} />
        <div style={{ lineHeight: 1.2 }}>
          <div style={{ fontSize: 13, fontWeight: 700 }}>{name}</div>
          <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{greeting()}, {roleLabel(role)}</div>
        </div>
      </Link>
    </header>
  );
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  const branding = await getAcademyBranding();
  const user = session ? await prisma.user.findUnique({ where: { id: session.userId }, select: { photoUrl: true, theme: true, email: true } }) : null;
  const photoUrl = user?.photoUrl ?? null;
  const theme = user?.theme ?? "light";
  const currentEmail = user?.email ?? "";
  const perms = await getPermissions();
  const requestsBadge = await getRequestsBadge(perms);
  const navItems = getNavItems(perms, requestsBadge);

  return (
    <html lang="en" data-theme={theme}>
      <body>
        <ServiceWorkerRegister />
        {session ? <InstallPrompt /> : null}
        {session ? <DevAccountSwitcher currentEmail={currentEmail} /> : null}
        {session ? (
          <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
            <MobileNav
              userName={session.name}
              userRole={session.role}
              photoUrl={photoUrl}
              logoutAction={logout}
              items={navItems}
              academyName={branding.academyName}
              logoUrl={branding.logoUrl}
            />
            <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
              <aside
                className="desktop-sidebar"
                style={{
                  width: 236,
                  flexShrink: 0,
                  background: "var(--primary-dark)",
                  color: "#fff",
                  flexDirection: "column",
                  position: "sticky",
                  top: 0,
                  height: "100vh",
                }}
              >
                <div style={{ padding: "20px 20px 16px" }}>
                  {branding.logoUrl ? (
                    <img
                      src={branding.logoUrl}
                      alt={branding.academyName}
                      style={{ maxWidth: 180, maxHeight: 40, objectFit: "contain", display: "block", marginBottom: 6 }}
                    />
                  ) : (
                    <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                      <Icon name="football" size={22} style={{ color: "var(--accent)", flexShrink: 0 }} />
                      <div
                        style={{
                          fontSize: 21,
                          fontWeight: 800,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {branding.academyName}
                      </div>
                    </div>
                  )}
                  {branding.logoUrl && (
                    <div
                      style={{
                        fontSize: 15,
                        fontWeight: 800,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        marginTop: 6,
                      }}
                    >
                      {branding.academyName}
                    </div>
                  )}
                  <div style={{ fontSize: 11, fontWeight: 600, opacity: 0.6, marginTop: 4 }}>Powered by Touchline</div>
                </div>

                <SidebarNav items={navItems} />

                <div style={{ padding: "16px 20px 20px", borderTop: "1px solid rgba(255,255,255,0.1)", marginTop: 12 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                    <Avatar name={session.name} src={photoUrl} size={36} />
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{session.name}</div>
                      <div style={{ fontSize: 11, opacity: 0.65 }}>{roleLabel(session.role)}</div>
                    </div>
                  </div>
                  <form action={logout}>
                    <button
                      type="submit"
                      style={{
                        width: "100%",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 8,
                        padding: "8px 10px",
                        background: "rgba(255,255,255,0.07)",
                        color: "#fff",
                        border: "1px solid rgba(255,255,255,0.18)",
                        borderRadius: 8,
                        cursor: "pointer",
                        fontSize: 12.5,
                        fontWeight: 600,
                        transition: "background var(--transition)",
                      }}
                    >
                      <Icon name="logout" size={15} />
                      Sign out
                    </button>
                  </form>
                </div>
              </aside>

              <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
                <TopHeader name={session.name} role={session.role} photoUrl={photoUrl} />
                <main style={{ flex: 1, padding: "28px 28px 48px", width: "100%", maxWidth: 1060, margin: "0 auto" }}>{children}</main>
              </div>
            </div>
          </div>
        ) : (
          children
        )}
      </body>
    </html>
  );
}