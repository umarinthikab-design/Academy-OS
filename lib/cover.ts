import type { CSSProperties } from "react";

export type Crop = { x: number; y: number; zoom: number };

// A drill cover crop is stored as "x y zoom", e.g. "40 30 1.5":
// x / y = the point of the photo kept in the middle (0-100), zoom = 1 to 3.
export function parseCrop(v: unknown): Crop | null {
  if (typeof v !== "string") return null;
  const m = v.trim().match(/^(\d{1,3}(?:\.\d+)?) (\d{1,3}(?:\.\d+)?) (\d(?:\.\d+)?)$/);
  if (!m) return null;
  const x = Number(m[1]);
  const y = Number(m[2]);
  const zoom = Number(m[3]);
  if (x > 100 || y > 100 || zoom < 1 || zoom > 3) return null;
  return { x, y, zoom };
}

export function cropImgStyle(v?: string | null): CSSProperties {
  const c = parseCrop(v) ?? { x: 50, y: 50, zoom: 1 };
  return {
    width: "100%",
    height: "100%",
    objectFit: "cover",
    objectPosition: `${c.x}% ${c.y}%`,
    transform: c.zoom > 1 ? `scale(${c.zoom})` : undefined,
    transformOrigin: `${c.x}% ${c.y}%`,
  };
}