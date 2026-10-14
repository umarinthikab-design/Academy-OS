import type { ReactNode } from "react";

// One section card for settings-style pages (personal Settings and Club
// Settings), so both share the same spacing, title and divider.

export function SettingsSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-lg)",
        boxShadow: "var(--shadow-sm)",
        padding: 24,
      }}
    >
      <h2
        style={{
          fontSize: 20,
          fontWeight: 600,
          color: "var(--text-heading)",
          paddingBottom: 12,
          borderBottom: "1px solid var(--border)",
          marginBottom: description ? 16 : 20,
        }}
      >
        {title}
      </h2>
      {description && (
        <p style={{ fontSize: 14, color: "var(--text-muted)", margin: "0 0 20px", lineHeight: 1.5 }}>
          {description}
        </p>
      )}
      {children}
    </section>
  );
}
