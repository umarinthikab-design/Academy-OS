"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Button } from "./Button";

// Reusable view preference: storage is read after hydration and scoped per page.
export function ListView({ storageKey, children }: { storageKey: string; children: ReactNode }) {
  const [view, setView] = useState<"tiles" | "list">("tiles");
  useEffect(() => {
    try { if (localStorage.getItem(storageKey) === "list") setView("list"); } catch { /* Storage may be blocked. */ }
  }, [storageKey]);
  function choose(next: "tiles" | "list") {
    setView(next);
    try { localStorage.setItem(storageKey, next); } catch { /* Preference still works for this visit. */ }
  }
  return (
    <div>
      <div className="view-switch" role="group" aria-label="Session display">
        <span style={{ fontSize: 13, color: "var(--text-muted)" }}>View:</span>
        <Button type="button" size="sm" variant={view === "tiles" ? "approval" : "outline"} aria-pressed={view === "tiles"} onClick={() => choose("tiles")}>Tiles</Button>
        <Button type="button" size="sm" variant={view === "list" ? "approval" : "outline"} aria-pressed={view === "list"} onClick={() => choose("list")}>List</Button>
      </div>
      <div className={view === "tiles" ? "compact-grid" : undefined} style={view === "list" ? { display: "flex", flexDirection: "column", gap: 10 } : undefined}>{children}</div>
    </div>
  );
}
