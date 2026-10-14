"use client";

// The one Button component used everywhere. Variants keep a single accent
// hierarchy: one primary per view, neutral secondaries, red only for
// destructive actions. Renders a <button> by default, or <a> when `href` is
// given (useful for links that should look like buttons without extra
// styling at the call site).

import { Icon } from "./Icon";

type Variant = "primary" | "secondary" | "outline" | "ghost" | "danger" | "approval";
type Size = "sm" | "md";

const VARIANTS: Record<Variant, React.CSSProperties> = {
  primary: {
    background: "var(--btn-primary-bg)",
    color: "var(--btn-primary-text)",
    border: "1px solid var(--btn-primary-bg)",
  },
  secondary: {
    background: "var(--secondary)",
    color: "var(--btn-secondary-text)",
    border: "1px solid var(--secondary)",
  },
  approval: {
    background: "var(--btn-approval-bg)",
    color: "var(--btn-approval-text)",
    border: "1px solid var(--btn-approval-bg)",
  },
  outline: {
    background: "var(--surface)",
    color: "var(--text-heading)",
    border: "1px solid var(--border)",
  },
  ghost: {
    background: "transparent",
    color: "var(--text-muted)",
    border: "1px solid transparent",
  },
  danger: {
    background: "transparent",
    color: "var(--error)",
    border: "1px solid var(--error)",
  },
};

const SIZES: Record<Size, React.CSSProperties> = {
  sm: { padding: "5px 12px", fontSize: 13 },
  md: { padding: "8px 16px", fontSize: 14 },
};

export function Button({
  children,
  variant = "primary",
  size = "md",
  icon,
  full,
  href,
  style,
  ...rest
}: {
  children?: React.ReactNode;
  variant?: Variant;
  size?: Size;
  icon?: string;
  full?: boolean;
  href?: string;
  style?: React.CSSProperties;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const styles: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    fontWeight: 700,
    borderRadius: 8,
    cursor: "pointer",
    transition: "all var(--transition)",
    lineHeight: 1.3,
    whiteSpace: "nowrap",
    textDecoration: "none",
    ...VARIANTS[variant],
    ...SIZES[size],
    ...(full ? { width: "100%" } : {}),
    ...style,
  };

  const content = (
    <>
      {icon && <Icon name={icon} size={size === "sm" ? 14 : 16} />}
      {children}
    </>
  );

  if (href) {
    return (
      <a href={href} className="ui-btn" style={styles}>
        {content}
      </a>
    );
  }
  return (
    <button type="submit" className="ui-btn" style={styles} {...(rest as React.ButtonHTMLAttributes<HTMLButtonElement>)}>
      {content}
    </button>
  );
}