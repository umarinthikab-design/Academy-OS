// EntityHero - avatar + name/heading + badge row used on entity cards and
// pages (squad list, player detail, coaches). The badge row gets a -9px left
// margin so the first pill's text lines up with the heading.
// The eh-* class names are hooks for the phone layouts in globals.css.

import { Avatar } from "./Avatar";
import Link from "next/link";

export function EntityHero({
  name,
  src,
  size = 42,
  href,
  heading,
  subtitle,
  badges,
  actions,
  badgeRowStyle,
}: {
  name: string;
  src?: string | null;
  size?: number;
  href?: string;
  heading?: React.ReactNode;
  subtitle?: React.ReactNode;
  badges?: React.ReactNode;
  actions?: React.ReactNode;
  badgeRowStyle?: React.CSSProperties;
}) {
  const title =
    heading ??

    (href ? (
      <Link className="text-link" href={href} style={{ fontSize: 16, fontWeight: 800, color: "var(--text-heading)", textDecoration: "none" }}>
        {name}
      </Link>
    ) : (
      <span style={{ fontSize: 16, fontWeight: 800 }}>{name}</span>
    ));

  return (
    <div className="eh-root" style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, minWidth: 0, flexWrap: "wrap" }}>
      <div className="eh-id" style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
        <Avatar name={name} src={src} size={size} />
        <div className="eh-text" style={{ minWidth: 0 }}>
          {title}
          {badges && (
            <div
              className="eh-badges"
              style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 3, marginLeft: -9, flexWrap: "wrap", ...badgeRowStyle }}
            >
              {badges}
            </div>
          )}
          {subtitle && <div className="eh-sub">{subtitle}</div>}
        </div>
      </div>
      {actions && <div className="eh-actions" style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", maxWidth: "100%" }}>{actions}</div>}
    </div>
  );
}
