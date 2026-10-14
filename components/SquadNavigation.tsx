"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { safeSquadReturn, SQUAD_RETURN_KEY } from "@/lib/squadReturn";

type SquadPosition = { url: string; playerId: string; y: number; expanded: string[]; restore?: boolean };
function readPosition(): SquadPosition | null {
  try {
    const value = JSON.parse(sessionStorage.getItem(SQUAD_RETURN_KEY) ?? "null");
    return value && typeof value.url === "string" && typeof value.playerId === "string" && Number.isFinite(value.y) ? value : null;
  } catch { return null; }
}
function writePosition(value: SquadPosition) {
  try { sessionStorage.setItem(SQUAD_RETURN_KEY, JSON.stringify(value)); } catch { /* Anchor navigation remains available. */ }
}

export function SquadPlayerLink({ playerId, appearance = "button", children }: { playerId: string; appearance?: "button" | "name"; children: ReactNode }) {
  const pathname = usePathname();
  const params = useSearchParams();
  const query = params.toString();
  const returnTo = safeSquadReturn(`${pathname}${query ? "?" + query : ""}#player-card-${playerId}`);
  const href = `/squad/${playerId}?returnTo=${encodeURIComponent(returnTo)}`;
  function remember() {
    const expanded = Array.from(document.querySelectorAll(".squad-grid > div"))
      .filter(card => card.querySelector("details[open]")) .map(card => card.id);
    writePosition({ url: returnTo, playerId, y: window.scrollY, expanded });
  }
  return <Link href={href} onClick={remember} className={appearance === "button" ? "ui-btn" : "text-link"}
    style={appearance === "button" ? { display: "inline-flex", padding: "5px 12px", fontSize: 13, fontWeight: 700, border: "1px solid var(--border)", borderRadius: 8, color: "var(--text-heading)", background: "var(--surface)", textDecoration: "none" } : { fontSize: 16, fontWeight: 800, color: "var(--text-heading)", textDecoration: "none" }}>{children}</Link>;
}

export function BackToSquad({ playerId, returnTo }: { playerId: string; returnTo: string }) {
  const [destination, setDestination] = useState(safeSquadReturn(returnTo) === "/squad" ? `/squad#player-card-${playerId}` : safeSquadReturn(returnTo));
  useEffect(() => {
    const saved = readPosition();
    if (saved?.playerId === playerId && returnTo === "/squad") setDestination(safeSquadReturn(saved.url));
  }, [playerId, returnTo]);
  function restore() {
    const saved = readPosition();
    if (saved?.playerId === playerId) writePosition({ ...saved, restore: true });
  }
  return <Link href={destination} scroll={false} onClick={restore} className="ui-btn"
    style={{ display: "inline-flex", gap: 6, padding: "7px 12px", border: "1px solid var(--border)", borderRadius: 8, color: "var(--text)", background: "var(--surface)", fontWeight: 700, fontSize: 13, textDecoration: "none", marginBottom: 16 }}>← Back to squad</Link>;
}

export function SquadScrollRestore() {
  const pathname = usePathname();
  const params = useSearchParams();
  useEffect(() => {
    const saved = readPosition();
    const expected = safeSquadReturn(saved?.url).split("#")[0];
    const actual = pathname + (params.toString() ? "?" + params.toString() : "");
    if (!saved?.restore || expected !== actual) {
      if (!saved && window.location.hash.startsWith("#player-card-")) document.getElementById(decodeURIComponent(window.location.hash.slice(1)))?.scrollIntoView({ block: "start" });
      return;
    }
    for (const id of saved.expanded ?? []) {
      const details = document.getElementById(id)?.querySelector("details");
      if (details) details.open = true;
    }
    const frame = requestAnimationFrame(() => {
      window.scrollTo({ top: saved.y, behavior: "instant" });
      writePosition({ ...saved, restore: false });
    });
    return () => cancelAnimationFrame(frame);
  }, [pathname, params]);
  return null;
}
