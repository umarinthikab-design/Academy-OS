import "./globals.css";
import { Inter, Archivo_Narrow } from "next/font/google";
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
import Link from "next/link";
import type { Metadata, Viewport } from "next";

// Body/data: Inter. Headlines: Archivo Narrow (condensed "scoreboard" feel).
// Variables feed the --font-body / --font-headline tokens in globals.css.
const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const archivoNarrow = Archivo_Narrow({ subsets: ["latin"], variable: "--font-archivo-narrow", display: "swap" });

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
      icon: [
        { url: "/favicon.png", sizes: "32x32", type: "image/png" },
        { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
        { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
      ],
    },
  };
}

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#00261b" },
    { media: "(prefers-color-scheme: dark)", color: "#000f0a" },
  ],
};

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

  // Dev-only convenience switcher. The dynamic import sits behind a
  // build-time-inlined NODE_ENV check, so in production builds neither the
  // component nor its hardcoded account credentials reach the client JS.
  let devSwitcher: React.ReactNode = null;
  if (session && process.env.NODE_ENV !== "production") {
    const { DevAccountSwitcher } = await import("@/components/DevAccountSwitcher");
    devSwitcher = <DevAccountSwitcher currentEmail={currentEmail} />;
  }

  return (
    <html lang="en" data-theme={theme} className={`${inter.variable} ${archivoNarrow.variable}`}>
      <body>
        <ServiceWorkerRegister />
        {session ? <InstallPrompt /> : null}
        {devSwitcher}
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
              {/* Desktop sidebar — the single source of navigation (no top
                  bar), styled per the Stitch exports: deep pitch background,
                  primary-container border, profile + sign-out pinned bottom. */}
              <aside
                className="desktop-sidebar"
                style={{
                  width: 256,
                  flexShrink: 0,
                  background: "var(--primary)",
                  color: "#fff",
                  flexDirection: "column",
                  position: "sticky",
                  top: 0,
                  height: "100vh",
                  borderRight: "1px solid var(--primary-container)",
                }}
              >
                <div style={{ padding: "24px 16px 24px", display: "flex", alignItems: "center", gap: 12 }}>
                  {branding.logoUrl ? (
                    <img
                      src={branding.logoUrl}
                      alt=""
                      style={{ width: 40, height: 40, borderRadius: "50%", objectFit: "contain", background: "var(--surface)", flexShrink: 0 }}
                    />
                  ) : (
                    <div
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: "50%",
                        background: "var(--primary-container)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                      }}
                    >
                      <Icon name="football" size={20} style={{ color: "var(--accent)" }} />
                    </div>
                  )}
                  <div style={{ minWidth: 0 }}>
                    <div
                      style={{
                        fontFamily: "var(--font-headline)",
                        fontSize: 20,
                        fontWeight: 700,
                        lineHeight: 1.15,
                        color: "#fff",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {branding.academyName}
                    </div>
                    <div style={{ fontSize: 12, color: "var(--primary-fixed-dim)", marginTop: 1 }}>Powered by Touchline</div>
                  </div>
                </div>

                <SidebarNav items={navItems} />

                <div style={{ padding: "16px 16px 20px", borderTop: "1px solid var(--primary-container)", marginTop: 12 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12, padding: "0 8px" }}>
                    <Avatar name={session.name} src={photoUrl} size={36} />
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{session.name}</div>
                      <div style={{ fontSize: 11, color: "var(--primary-fixed-dim)" }}>{roleLabel(session.role)}</div>
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
                        padding: "9px 10px",
                        background: "transparent",
                        color: "var(--primary-fixed-dim)",
                        border: "1px solid var(--primary-container)",
                        borderRadius: 8,
                        cursor: "pointer",
                        fontSize: 12.5,
                        fontWeight: 600,
                        transition: "background var(--transition), color var(--transition)",
                      }}
                    >
                      <Icon name="logout" size={15} />
                      Sign out
                    </button>
                  </form>
                </div>
              </aside>

              {/* Tablet rail — persistent but icon-only, between the phone's
                  hidden hamburger drawer and the desktop's full labeled
                  sidebar (see .tablet-sidebar in globals.css). Same
                  SidebarNav component/data as desktop, just `compact`. */}
              <aside
                className="tablet-sidebar"
                style={{
                  width: 72,
                  flexShrink: 0,
                  background: "var(--primary)",
                  color: "#fff",
                  flexDirection: "column",
                  position: "sticky",
                  top: 0,
                  height: "100vh",
                  borderRight: "1px solid var(--primary-container)",
                }}
              >
                <div style={{ padding: "20px 0", display: "flex", justifyContent: "center" }}>
                  {branding.logoUrl ? (
                    <img
                      src={branding.logoUrl}
                      alt={branding.academyName}
                      title={branding.academyName}
                      style={{ width: 36, height: 36, borderRadius: "50%", objectFit: "contain", background: "var(--surface)", flexShrink: 0 }}
                    />
                  ) : (
                    <div
                      title={branding.academyName}
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: "50%",
                        background: "var(--primary-container)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                      }}
                    >
                      <Icon name="football" size={18} style={{ color: "var(--accent)" }} />
                    </div>
                  )}
                </div>

                <SidebarNav items={navItems} compact />

                <div style={{ padding: "12px 8px 16px", borderTop: "1px solid var(--primary-container)", marginTop: 12, display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
                  <Link href="/settings" title={`${session.name} · ${roleLabel(session.role)}`}>
                    <Avatar name={session.name} src={photoUrl} size={32} />
                  </Link>
                  <form action={logout}>
                    <button
                      type="submit"
                      title="Sign out"
                      aria-label="Sign out"
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        padding: 8,
                        background: "transparent",
                        color: "var(--primary-fixed-dim)",
                        border: "1px solid var(--primary-container)",
                        borderRadius: 8,
                        cursor: "pointer",
                        transition: "background var(--transition), color var(--transition)",
                      }}
                    >
                      <Icon name="logout" size={15} />
                    </button>
                  </form>
                </div>
              </aside>

              <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
                <main style={{ flex: 1, padding: "28px 32px 48px", width: "100%", maxWidth: 1100, margin: "0 auto" }}>{children}</main>
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