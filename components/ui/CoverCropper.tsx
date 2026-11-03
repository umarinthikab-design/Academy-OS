"use client";

import { useRef, useState } from "react";
import { cropImgStyle, parseCrop } from "@/lib/cover";

// Drag on the photo to choose which part stays in the middle of the card,
// and use the slider to zoom in. Saved with the drill form as "coverCrop".
export function CoverCropper({ src, value }: { src: string; value?: string | null }) {
  const [c, setC] = useState(parseCrop(value) ?? { x: 50, y: 50, zoom: 1 });
  const frame = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  function pick(e: React.PointerEvent) {
    const r = frame.current?.getBoundingClientRect();
    if (!r) return;
    const x = Math.min(100, Math.max(0, ((e.clientX - r.left) / r.width) * 100));
    const y = Math.min(100, Math.max(0, ((e.clientY - r.top) / r.height) * 100));
    setC((p) => ({ ...p, x: Math.round(x), y: Math.round(y) }));
  }

  const css = `${c.x}% ${c.y}%`;
  return (
    <div style={{ marginTop: 10 }}>
      <label style={{ display: "block", fontSize: 13, fontWeight: 700, marginBottom: 6, color: "var(--text-muted)" }}>
        Cover photo - drag to centre, slide to zoom
      </label>
      <div
        ref={frame}
        onPointerDown={(e) => { dragging.current = true; e.currentTarget.setPointerCapture(e.pointerId); pick(e); }}
        onPointerMove={(e) => { if (dragging.current) pick(e); }}
        onPointerUp={() => { dragging.current = false; }}
        onPointerCancel={() => { dragging.current = false; }}
        style={{ position: "relative", height: 128, overflow: "hidden", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface-muted)", cursor: "grab", touchAction: "none" }}
      >
        <img src={src} alt="" draggable={false} style={{ ...cropImgStyle(`${c.x} ${c.y} ${c.zoom}`), userSelect: "none", pointerEvents: "none" }} />
        <span style={{ position: "absolute", left: css.split(" ")[0], top: css.split(" ")[1], width: 14, height: 14, marginLeft: -7, marginTop: -7, borderRadius: "50%", border: "2px solid #fff", boxShadow: "0 0 0 1px rgba(0,0,0,0.5)", pointerEvents: "none" }} />
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 8 }}>
        <span style={{ fontSize: 13, color: "var(--text-muted)" }}>Zoom</span>
        <input type="range" min={1} max={3} step={0.1} value={c.zoom} onChange={(e) => setC((p) => ({ ...p, zoom: Number(e.target.value) }))} style={{ flex: 1 }} />
        <button type="button" onClick={() => setC({ x: 50, y: 50, zoom: 1 })} style={{ padding: "6px 12px", border: "1px solid var(--border)", borderRadius: 8, background: "var(--surface)", color: "var(--text)", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
          Reset
        </button>
      </div>
      <input type="hidden" name="coverCrop" value={`${c.x} ${c.y} ${Math.round(c.zoom * 10) / 10}`} />
    </div>
  );
}