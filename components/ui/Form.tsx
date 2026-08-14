// Form primitives: Field (label + control wrapper), Input, Select, Textarea.
// Shared focus states and sizing keep every form consistent.

import type { CSSProperties, ReactNode } from "react";

export const inputBase: CSSProperties = {
  width: "100%",
  padding: "9px 12px",
  border: "1px solid var(--border)",
  borderRadius: 8,
  background: "var(--surface)",
  fontSize: 14,
  color: "var(--text)",
  boxSizing: "border-box",
  transition: "border-color var(--transition), box-shadow var(--transition)",
};

export function Field({
  label,
  hint,
  children,
  style,
}: {
  label?: string;
  hint?: string;
  children: ReactNode;
  style?: CSSProperties;
}) {
  return (
    <div style={style}>
      {label && (
        <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "var(--text)", marginBottom: 5 }}>
          {label}
        </label>
      )}
      {children}
      {hint && (
        <p style={{ margin: "5px 0 0", fontSize: 12, color: "var(--text-faint)" }}>{hint}</p>
      )}
    </div>
  );
}

export function Input(props: React.InputHTMLAttributes<HTMLInputElement> & { style?: CSSProperties }) {
  const { style, ...rest } = props;
  return <input {...rest} style={{ ...inputBase, ...style }} />;
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement> & { style?: CSSProperties }) {
  const { style, children, ...rest } = props;
  return (
    <select {...rest} style={{ ...inputBase, paddingRight: 30, ...style }}>
      {children}
    </select>
  );
}

export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { style?: CSSProperties }) {
  const { style, ...rest } = props;
  return <textarea {...rest} style={{ ...inputBase, minHeight: 70, resize: "vertical", ...style }} />;
}