"use client";

// PromoteForm - the season-transition bulk-move form. Lives on the client so
// the "select all" toggle and the live summary ("Moving 12 players from U9
// Tigers to U11 Lions") can update as the coach picks checkboxes, without a
// page reload. The actual move still happens through the server action.

import { useState } from "react";
import { promotePlayers } from "@/app/squad/actions";

export function PromoteForm({
  sourceBatch,
  targetBatchId,
  targetBatches,
  players,
}: {
  sourceBatch: { id: string; name: string };
  targetBatchId: string;
  targetBatches: { id: string; name: string }[];
  players: { id: string; name: string }[];
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set(players.map((p) => p.id)));
  const [target, setTarget] = useState<string>(targetBatchId);
  const [showConfirm, setShowConfirm] = useState(false);

  const toggleAll = (checked: boolean) => {
    setSelected(checked ? new Set(players.map((p) => p.id)) : new Set());
  };

  const toggleOne = (id: string, checked: boolean) => {
    const next = new Set(selected);
    if (checked) next.add(id);
    else next.delete(id);
    setSelected(next);
  };

  const targetName = targetBatches.find((b) => b.id === target)?.name ?? "";
  const canSubmit = selected.size > 0 && showConfirm;

  const fieldLabel: React.CSSProperties = { display: "block", fontSize: 12, fontWeight: 700, marginBottom: 4, color: "var(--text)" };
  const inputBase: React.CSSProperties = { padding: "7px 10px", border: "1px solid var(--border)", borderRadius: 8, background: "var(--surface)", fontSize: 13, color: "var(--text)" };

  return (
    <form
      action={promotePlayers}
      onSubmit={(e) => {
        if (!canSubmit) e.preventDefault();
      }}
      style={{ display: "flex", flexDirection: "column", gap: 16 }}
    >
      <input type="hidden" name="targetBatchId" value={target} />

      <div className="form-grid-2col" style={{ gap: 12 }}>
        <div>
          <label style={fieldLabel}>Source batch</label>
          <input type="text" value={sourceBatch.name} readOnly disabled style={{ ...inputBase, width: "100%", background: "var(--surface-muted)" }} />
        </div>
        <div>
          <label style={fieldLabel}>Target batch</label>
          <select
            name="targetBatchPicker"
            value={target}
            onChange={(e) => {
              setTarget(e.target.value);
              setShowConfirm(false);
            }}
            style={{ ...inputBase, width: "100%" }}
          >
            {targetBatches.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <label style={{ fontSize: 13, fontWeight: 700 }}>
            Players to move <span style={{ color: "var(--text-muted)", fontWeight: 600 }}>({players.length})</span>
          </label>
          <label style={{ fontSize: 12, display: "inline-flex", alignItems: "center", gap: 5 }}>
            <input
              type="checkbox"
              checked={selected.size === players.length && players.length > 0}
              onChange={(e) => toggleAll(e.target.checked)}
            />{" "}
            Select all
          </label>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 360, overflowY: "auto", border: "1px solid var(--border)", borderRadius: 8, padding: 10 }}>
          {players.map((p) => (
            <label key={p.id} style={{ fontSize: 13, display: "flex", alignItems: "center", gap: 8, padding: "4px 2px", cursor: "pointer" }}>
              <input type="checkbox" name="playerIds" value={p.id} checked={selected.has(p.id)} onChange={(e) => toggleOne(p.id, e.target.checked)} />
              {p.name}
            </label>
          ))}
          {players.length === 0 && <span style={{ fontSize: 12, color: "var(--text-faint)" }}>No players in this batch.</span>}
        </div>
      </div>

      {/* Clear summary before the submit button, not a bare confirm() - this
          moves many players at once, so the scale should be obvious. */}
      <div style={{ background: "var(--surface-muted)", border: "1px solid var(--border)", borderRadius: 8, padding: "10px 14px", fontSize: 13 }}>
        <strong>{selected.size}</strong> {selected.size === 1 ? "player" : "players"} selected ·{" "}
        {selected.size > 0 ? (
          <>
            Moving from <strong>{sourceBatch.name}</strong> to <strong>{targetName}</strong>.
          </>
        ) : (
          "Select at least one player to move."
        )}
        <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
          Skill ratings, notes, and attendance stay attached to each player — only batch membership changes.
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <button
          type="submit"
          disabled={!canSubmit}
          style={{
            padding: "10px 20px",
            background: "var(--primary)",
            color: "#fff",
            border: "none",
            borderRadius: 8,
            fontWeight: 700,
            fontSize: 13,
            cursor: canSubmit ? "pointer" : "not-allowed",
            opacity: canSubmit ? 1 : 0.5,
          }}
        >
          Move {selected.size} {selected.size === 1 ? "player" : "players"}
        </button>
        {selected.size > 0 && (
          <label style={{ fontSize: 12, display: "inline-flex", alignItems: "center", gap: 5, color: "var(--text-muted)" }}>
            <input type="checkbox" checked={showConfirm} onChange={(e) => setShowConfirm(e.target.checked)} />
            I understand this changes batch membership for all selected players
          </label>
        )}
      </div>

      {selected.size > 0 && !showConfirm && (
        <p style={{ fontSize: 12, color: "var(--warning)", fontWeight: 600, margin: 0 }}>
          Tick the confirmation box to enable the move.
        </p>
      )}
    </form>
  );
}
