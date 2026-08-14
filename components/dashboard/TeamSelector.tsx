"use client";

// Assignment-aware team filter. Renders pills for [All] plus every group the
// current user is actually assigned to. Filtering is done via the URL's
// `team` param, so the server component re-queries with a DB-scoped where
// clause — the client never hides data, it only requests a narrower scope.

import Link from "next/link";

export function TeamSelector({
  teams,
  current,
  basePath = "/",
}: {
  teams: { id: string; name: string; ageGroupName?: string }[];
  current: string | null;
  basePath?: string;
}) {
  const pill = (label: string, active: boolean, href: string) => (
    <Link
      key={href}
      href={href}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "6px 14px",
        borderRadius: "var(--radius-pill)",
        fontSize: 12.5,
        fontWeight: 700,
        textDecoration: "none",
        whiteSpace: "nowrap",
        border: active ? "1px solid var(--secondary)" : "1px solid var(--border)",
        background: active ? "var(--secondary)" : "var(--surface)",
        color: active ? "#fff" : "var(--text-muted)",
        transition: "background var(--transition), color var(--transition), border-color var(--transition)",
      }}
    >
      {label}
    </Link>
  );

  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
      {pill("All", current === null, basePath)}
      {teams.map((t) => pill(t.name, current === t.id, `${basePath}?team=${t.id}`))}
    </div>
  );
}
