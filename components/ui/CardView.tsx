"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Button } from "./Button";

// Tiles / list switcher for card collections. Like ListView, but with its own
// grid so it fits cards of any size. The choice is remembered per page.
export function CardView({
  storageKey,
  defaultView = "tiles",
  minTile = 280,
  label = "Display",
  children,
}: {
  storageKey: string;
  defaultView?: "tiles" | "list";
  minTile?: number;
  label?: string;
  children: ReactNode;
}) {
  const [view, setView] = useState<"tiles" | "list">(defaultView);
  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved === "tiles" || saved === "list") setView(saved);
    } catch { /* Storage may be blocked. */ }
  }, [storageKey]);
  function choose(next: "tiles" | "list") {
    setView(next);
    try { localStorage.setItem(storageKey, next); } catch { /* Preference still works for this visit. */ }
  }
  return (
    <div>
      <div className="view-switch" role="group" aria-label={label}>
        <span style={{ fontSize: 13, color: "var(--text-muted)" }}>View:</span>
        <Button type="button" size="sm" variant={view === "tiles" ? "approval" : "outline"} aria-pressed={view === "tiles"} onClick={() => choose("tiles")}>Tiles</Button>
        <Button type="button" size="sm" variant={view === "list" ? "approval" : "outline"} aria-pressed={view === "list"} onClick={() => choose("list")}>List</Button>
      </div>
      <div
        style={
          view === "tiles"
            ? { display: "grid", gridTemplateColumns: `repeat(auto-fill, minmax(${minTile}px, 1fr))`, gap: 16 }
            : { display: "flex", flexDirection: "column", gap: 12 }
        }
      >
        {children}
      </div>
    </div>
  );
}