// DashboardHero - the pitch-themed greeting banner used by every role
// dashboard. Subtitle is role-specific; the markup stays consistent.

import { Icon } from "@/components/ui/Icon";

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

export function DashboardHero({
  name,
  subtitle,
  actions,
}: {
  name: string;
  subtitle: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <section
      style={{
        borderRadius: "var(--radius-lg)",
        background: "linear-gradient(135deg, var(--primary-dark) 0%, var(--primary) 60%, #155e3b 100%)",
        color: "#fff",
        padding: "28px 30px",
        position: "relative",
        overflow: "hidden",
        boxShadow: "var(--shadow-md)",
      }}
    >
      {/* Subtle pitch markings */}
      <div style={{ position: "absolute", inset: 0, opacity: 0.08, backgroundImage: "repeating-linear-gradient(90deg, transparent 0 90px, rgba(255,255,255,1) 90px 91px)" }} />
      <div style={{ position: "absolute", right: -40, bottom: -70, width: 260, height: 260, borderRadius: "50%", border: "2px solid rgba(255,255,255,0.18)" }} />
      <div style={{ position: "absolute", right: 30, bottom: 0, width: 160, height: 160, borderRadius: "50%", border: "2px solid rgba(255,255,255,0.14)" }} />

      <div style={{ position: "relative" }}>
        <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", opacity: 0.7, color: "#fff" }}>
          {new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
        </div>
        <h1 style={{ fontSize: 30, fontWeight: 800, letterSpacing: "-0.02em", margin: "6px 0 6px", color: "#fff" }}>
          {greeting()}, {name.split(" ")[0]}.
        </h1>
        {subtitle && <p style={{ margin: 0, fontSize: 15, opacity: 0.85, maxWidth: 560, color: "#fff" }}>{subtitle}</p>}
        {actions && <div style={{ display: "flex", gap: 10, marginTop: 18, flexWrap: "wrap" }}>{actions}</div>}
      </div>
    </section>
  );
}

export { greeting };
