"use client";

// Password input with a show/hide toggle. A small client component so the
// toggle state can live locally - server components can't manage it.
// Props mirror a plain <input> where relevant.

import { useState } from "react";
import { Icon } from "./Icon";

export function PasswordField({
  name,
  placeholder,
  autoComplete,
  required = false,
  minLength,
  defaultValue,
  style,
}: {
  name: string;
  placeholder?: string;
  autoComplete?: string;
  required?: boolean;
  minLength?: number;
  defaultValue?: string;
  style?: React.CSSProperties;
}) {
  const [visible, setVisible] = useState(false);

  return (
    <div style={{ position: "relative", ...style }}>
      <input
        name={name}
        type={visible ? "text" : "password"}
        placeholder={placeholder}
        autoComplete={autoComplete}
        required={required}
        minLength={minLength}
        defaultValue={defaultValue}
        style={{ width: "100%", padding: "10px 40px 10px 12px", border: "1px solid var(--border)", borderRadius: 8, boxSizing: "border-box", fontSize: 14, background: "var(--surface)", color: "var(--text)" }}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        title={visible ? "Hide password" : "Show password"}
        aria-label={visible ? "Hide password" : "Show password"}
        style={{
          position: "absolute",
          right: 4,
          top: "50%",
          transform: "translateY(-50%)",
          border: "none",
          background: "transparent",
          color: "var(--text-muted)",
          cursor: "pointer",
          padding: "6px 8px",
          display: "flex",
          alignItems: "center",
        }}
      >
        <Icon name={visible ? "eye-off" : "eye"} size={16} />
      </button>
    </div>
  );
}