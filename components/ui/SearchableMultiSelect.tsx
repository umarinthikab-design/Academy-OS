"use client";

// Searchable multi-select used in create forms where a simple checkbox grid
// gets unwieldy (coaches for a batch, players for a batch). Renders a button
// that opens a dropdown with a search box and optional filter dropdowns, and
// writes the selected ids as hidden inputs named `name` so the surrounding
// server-action form reads them with formData.getAll(name) exactly like the
// checkbox grids it replaces.

import { useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "./Icon";

export type MultiSelectFilter = {
  key: string;
  label: string;
  choices: { value: string; label: string }[];
};

export type MultiSelectOption = {
  id: string;
  label: string;
  sublabel?: string;
  // Map of filter key -> value for this option, matched against the active
  // filter selections (e.g. { age: "14", squad: "<batchId>" }).
  filterValues?: Record<string, string>;
};

export function SearchableMultiSelect({
  name,
  options,
  placeholder,
  selected = [],
  filters,
  emptyText = "No options to pick from.",
}: {
  name: string;
  options: MultiSelectOption[];
  placeholder: string;
  selected?: string[];
  filters?: MultiSelectFilter[];
  emptyText?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<string[]>(selected);
  const [activeFilters, setActiveFilters] = useState<Record<string, string>>({});
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return options.filter((o) => {
      if (q && !o.label.toLowerCase().includes(q) && !(o.sublabel ?? "").toLowerCase().includes(q)) return false;
      for (const f of filters ?? []) {
        const want = activeFilters[f.key];
        if (want && o.filterValues?.[f.key] !== want) return false;
      }
      return true;
    });
  }, [options, query, activeFilters, filters]);

  const toggle = (id: string) => {
    setPicked((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  return (
    <div ref={rootRef} style={{ position: "relative" }}>
      {picked.map((id) => (
        <input key={id} type="hidden" name={name} value={id} />
      ))}

      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
          padding: "9px 12px",
          border: "1px solid var(--border)",
          borderRadius: 8,
          background: "var(--surface)",
          color: "var(--text)",
          fontSize: 14,
          cursor: "pointer",
          textAlign: "left",
        }}
      >
        <span style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
          <Icon name="search" size={15} style={{ color: "var(--text-faint)", flexShrink: 0 }} />
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: picked.length ? "var(--text)" : "var(--text-muted)" }}>
            {picked.length > 0 ? `${placeholder} (${picked.length} selected)` : placeholder}
          </span>
        </span>
        <Icon name={open ? "chevronDown" : "chevronDown"} size={15} style={{ color: "var(--text-faint)", flexShrink: 0, transform: open ? "rotate(180deg)" : undefined, transition: "transform var(--transition)" }} />
      </button>

      {open && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            left: 0,
            right: 0,
            zIndex: 30,
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius)",
            boxShadow: "var(--shadow-md)",
            padding: 10,
            maxHeight: 300,
            display: "flex",
            flexDirection: "column",
            gap: 8,
          }}
        >
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search..."
            style={{
              width: "100%",
              padding: "7px 10px",
              border: "1px solid var(--border)",
              borderRadius: 8,
              background: "var(--surface)",
              color: "var(--text)",
              fontSize: 13,
            }}
          />

          {filters && filters.length > 0 && (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {filters.map((f) => (
                <select
                  key={f.key}
                  value={activeFilters[f.key] ?? ""}
                  onChange={(e) => setActiveFilters((prev) => ({ ...prev, [f.key]: e.target.value }))}
                  style={{
                    flex: 1,
                    minWidth: 110,
                    padding: "6px 8px",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    background: "var(--surface)",
                    color: "var(--text)",
                    fontSize: 12.5,
                  }}
                >
                  <option value="">{f.label}: All</option>
                  {f.choices.map((c) => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              ))}
            </div>
          )}

          <div style={{ overflowY: "auto", maxHeight: 190, display: "flex", flexDirection: "column", gap: 2 }}>
            {filtered.length === 0 ? (
              <span style={{ fontSize: 12.5, color: "var(--text-faint)", padding: "6px 4px" }}>{emptyText}</span>
            ) : (
              filtered.map((o) => {
                const checked = picked.includes(o.id);
                return (
                  <label
                    key={o.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      padding: "6px 8px",
                      borderRadius: 6,
                      cursor: "pointer",
                      fontSize: 13,
                      background: checked ? "var(--secondary)" : undefined,
                      color: checked ? "#fff" : "var(--text)",
                    }}
                  >
                    <input type="checkbox" checked={checked} onChange={() => toggle(o.id)} style={{ accentColor: "var(--secondary)" }} />
                    <span style={{ minWidth: 0, flex: 1 }}>
                      <span style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{o.label}</span>
                      {o.sublabel && (
                        <span style={{ display: "block", fontSize: 11, opacity: 0.8, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{o.sublabel}</span>
                      )}
                    </span>
                  </label>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
