// EntityHero - avatar + name/heading + badge row used on entity cards and
// pages (squad list, player detail, coaches). Centralizes the alignment fix:
// Badge pills have 9px horizontal padding, which shoves a badge row's text
// ~9px right of a flush heading above it. The badge row gets a -9px left
// margin so the first pill's text lines up with the heading.

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
      <Link href={href} style={{ fontSize: 16, fontWeight: 800, color: "var(--primary)", textDecoration: "none" }}>
        {name}
      </Link>
    ) : (
      <span style={{ fontSize: 16, fontWeight: 800 }}>{name}</span>
    ));

  return (
    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, minWidth: 0, flexWrap: "wrap" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
        <Avatar name={name} src={src} size={size} />
        <div style={{ minWidth: 0 }}>
          {title}
          {badges && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                marginTop: 3,
                marginLeft: -9,
                flexWrap: "wrap",
                ...badgeRowStyle,
              }}
            >
              {badges}
            </div>
          )}
          {subtitle}
        </div>
      </div>
      {actions && <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>{actions}</div>}
    </div>
  );
}
