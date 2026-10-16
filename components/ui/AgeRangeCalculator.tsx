"use client";

// Helper for Club Settings: fills every age group's "born from / born through"
// boxes from one reference date. Groups are named like "U10": a group covers
// players who are under that age, but not under the previous group's age, on
// the reference date. Nothing is saved until the form's Save button is pressed.

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Form";

type Group = { id: string; name: string };

const DAY = 24 * 60 * 60 * 1000;

function shiftYears(ref: Date, years: number): Date {
  const d = new Date(Date.UTC(ref.getUTCFullYear() - years, ref.getUTCMonth(), ref.getUTCDate()));
  if (d.getUTCMonth() !== ref.getUTCMonth()) d.setUTCDate(0); // 29 Feb in a non-leap year -> 28 Feb
  return d;
}

const iso = (d: Date) => d.toISOString().slice(0, 10);

export function AgeRangeCalculator({ groups }: { groups: Group[] }) {
  const [ref, setRef] = useState(`${new Date().getFullYear()}-01-01`);
  const [msg, setMsg] = useState("");

  function calculate() {
    const refDate = new Date(ref + "T00:00:00Z");
    if (!ref || isNaN(refDate.getTime())) {
      setMsg("Pick a valid reference date first.");
      return;
    }
    const withAge = groups
      .map((g) => {
        const m = g.name.match(/(\d+)/);
        return { ...g, n: m ? parseInt(m[1], 10) : NaN };
      })
      .filter((g) => !isNaN(g.n))
      .sort((a, b) => a.n - b.n);
    if (withAge.length === 0) {
      setMsg("No age numbers found in the group names (expected names like U10).");
      return;
    }
    const skipped = groups.length - withAge.length;
    let filled = 0;
    withAge.forEach((g, i) => {
      const step = i > 0 ? g.n - withAge[i - 1].n : withAge.length > 1 ? withAge[1].n - g.n : 2;
      const from = new Date(shiftYears(refDate, g.n).getTime() + DAY);
      const through = shiftYears(refDate, g.n - step);
      const f = document.querySelector<HTMLInputElement>(`input[name="dobFrom_${g.id}"]`);
      const t = document.querySelector<HTMLInputElement>(`input[name="dobTo_${g.id}"]`);
      if (f && t) {
        f.value = iso(from);
        t.value = iso(through);
        filled++;
      }
    });
    setMsg(
      `Filled ${filled} age group${filled === 1 ? "" : "s"}${skipped ? ` (${skipped} skipped - no age number in the name)` : ""}. Review, then press Save club settings.`
    );
  }

  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: 10,
        alignItems: "flex-end",
        padding: "12px 14px",
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius)",
      }}
    >
      <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 13, fontWeight: 600 }}>
        Age is counted on
        <Input type="date" value={ref} onChange={(e) => setRef(e.target.value)} />
      </label>
      <Button type="button" variant="outline" size="sm" onClick={calculate}>
        Calculate ranges
      </Button>
      <div style={{ fontSize: 12, color: "var(--text-muted)", flexBasis: "100%" }}>
        {msg || "A group named U10 covers players who are under 10 but not under 8 on this date."}
      </div>
    </div>
  );
}