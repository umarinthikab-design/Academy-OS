"use client";

// Upload a photo from the device and put the result into the surrounding
// form as a hidden field. The image is read client-side and opened in a small
// crop/align editor: rotate in 90° steps, drag a square crop box (and resize
// it) over the preview, then confirm. The result is written to a hidden input
// as a small JPEG data URL so the existing server actions keep working with a
// plain `photoUrl` string.
//
// Usage: render inside a <form> that submits to a server action, and read
// `name` (default "photoUrl") from the FormData as before.

import { useEffect, useRef, useState } from "react";
import { Avatar } from "./Avatar";
import { Icon } from "./Icon";

const MAX_FILE_BYTES = 5 * 1024 * 1024; // 5 MB
const MAX_DIMENSION = 256;
const BOX = 300; // preview square size in px

function readFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not read that image."));
    img.src = src;
  });
}

// Draw the rotated image into a canvas and return both canvas + dims.
function rotatedCanvas(img: HTMLImageElement, rotation: number): { canvas: HTMLCanvasElement; width: number; height: number } {
  const turns = ((rotation % 4) + 4) % 4;
  const swap = turns % 2 === 1;
  const width = swap ? img.height : img.width;
  const height = swap ? img.width : img.height;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return { canvas, width, height };
  ctx.translate(width / 2, height / 2);
  ctx.rotate((turns * Math.PI) / 2);
  ctx.drawImage(img, -img.width / 2, -img.height / 2);
  return { canvas, width, height };
}

export function PhotoUpload({
  name = "photoUrl",
  current,
  label = "Upload photo",
}: {
  name?: string;
  current?: string | null;
  label?: string;
}) {
  const [value, setValue] = useState<string>(current ?? "");
  const [removed, setRemoved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Editor state. `editing` is the original (unrotated) data URL; the crop box
  // lives in display pixels relative to the BOX square preview.
  const [editing, setEditing] = useState<string | null>(null);
  const [rotation, setRotation] = useState(0);
  const [crop, setCrop] = useState<{ x: number; y: number; size: number } | null>(null);
  const [fit, setFit] = useState<{ w: number; h: number; ox: number; oy: number; scale: number } | null>(null);
  const [drag, setDrag] = useState<null | "move" | "resize">(null);
  const [dragStart, setDragStart] = useState<{ px: number; py: number; x: number; y: number; size: number } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // After a save+redirect the server may pass back a fresh `current`;
  // reflect it so the preview matches what's actually stored.
  useEffect(() => {
    if (!removed) setValue(current ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current]);

  // Reset the crop box to the largest centered square that fits, given the
  // current rotation and the fitted preview layout.
  const resetCrop = (img: HTMLImageElement, rot: number, scale: number) => {
    const swap = ((rot % 4) + 4) % 4 % 2 === 1;
    const w = swap ? img.height : img.width;
    const h = swap ? img.width : img.height;
    const dispW = w * scale;
    const dispH = h * scale;
    const ox = (BOX - dispW) / 2;
    const oy = (BOX - dispH) / 2;
    const size = Math.min(dispW, dispH);
    setFit({ w: dispW, h: dispH, ox, oy, scale });
    setCrop({ x: ox + (dispW - size) / 2, y: oy + (dispH - size) / 2, size });
  };

  const onFile = async (file?: File | null) => {
    if (!file) return;
    setError(null);
    if (!file.type.startsWith("image/")) {
      setError("Please choose an image file (JPG, PNG, etc).");
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      setError("Image is too large — max 5 MB.");
      return;
    }
    setBusy(true);
    try {
      const raw = await readFile(file);
      const img = await loadImage(raw);
      const scale = Math.min(BOX / img.width, BOX / img.height);
      setEditing(raw);
      setRotation(0);
      resetCrop(img, 0, scale);
      setRemoved(false);
    } catch (e) {
      setError((e as Error).message || "Could not read that image.");
    } finally {
      setBusy(false);
    }
  };

  const rotate = (dir: 1 | -1) => {
    if (!editing) return;
    loadImage(editing).then((img) => {
      const next = (rotation + dir + 4) % 4;
      const scale = Math.min(BOX / (next % 2 === 1 ? img.height : img.width), BOX / (next % 2 === 1 ? img.width : img.height));
      setRotation(next);
      resetCrop(img, next, scale);
    });
  };

  // Pointer handlers for the crop box: dragging the box body moves it, the
  // corner handle resizes. Coordinates relative to the preview container.
  // Capture the pointer on the container so moves are tracked even when the
  // pointer leaves the box during a drag.
  const onBoxPointerDown = (e: React.PointerEvent, mode: "move" | "resize") => {
    if (!crop) return;
    e.preventDefault();
    e.stopPropagation();
    const container = e.currentTarget.closest("[data-cropbox]");
    if (container) (container as HTMLElement).setPointerCapture(e.pointerId);
    setDrag(mode);
    setDragStart({ px: e.clientX, py: e.clientY, x: crop.x, y: crop.y, size: crop.size });
  };

  const onPreviewPointerMove = (e: React.PointerEvent) => {
    if (!drag || !dragStart || !crop || !fit) return;
    const dx = e.clientX - dragStart.px;
    const dy = e.clientY - dragStart.py;

    if (drag === "move") {
      const x = Math.min(Math.max(dragStart.x + dx, fit.ox), fit.ox + fit.w - crop.size);
      const y = Math.min(Math.max(dragStart.y + dy, fit.oy), fit.oy + fit.h - crop.size);
      setCrop({ x, y, size: crop.size });
    } else {
      const d = Math.max(dx, dy);
      const size = Math.min(Math.max(dragStart.size + d, 48), Math.min(fit.w, fit.h));
      const x = Math.min(Math.max(dragStart.x, fit.ox), fit.ox + fit.w - size);
      const y = Math.min(Math.max(dragStart.y, fit.oy), fit.oy + fit.h - size);
      setCrop({ x, y, size });
    }
  };

  const endDrag = () => {
    setDrag(null);
    setDragStart(null);
  };

  // Apply the rotation + crop to produce the final square downscaled JPEG.
  const confirmCrop = async () => {
    if (!editing || !crop || !fit) return;
    setBusy(true);
    try {
      const img = await loadImage(editing);
      const { canvas: rotated, width: rw, height: rh } = rotatedCanvas(img, rotation);
      const scale = Math.min(BOX / rw, BOX / rh);
      const ox = (BOX - rw * scale) / 2;
      const oy = (BOX - rh * scale) / 2;
      const sx = (crop.x - ox) / scale;
      const sy = (crop.y - oy) / scale;
      const sSize = crop.size / scale;

      const out = document.createElement("canvas");
      out.width = MAX_DIMENSION;
      out.height = MAX_DIMENSION;
      const ctx = out.getContext("2d");
      if (ctx) {
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(rotated, sx, sy, sSize, sSize, 0, 0, MAX_DIMENSION, MAX_DIMENSION);
        setValue(out.toDataURL("image/jpeg", 0.85));
      }
      setEditing(null);
      setCrop(null);
      setFit(null);
      setRotation(0);
    } catch (e) {
      setError((e as Error).message || "Could not process that image.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <input type="hidden" name={name} value={removed ? "" : value} />
      <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
        <Avatar name="photo" src={removed ? null : value || current} size={64} />
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={busy}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "7px 14px",
                border: "1px solid var(--border)",
                background: "var(--surface)",
                color: "var(--text)",
                borderRadius: 8,
                cursor: "pointer",
                fontWeight: 700,
                fontSize: 12.5,
              }}
            >
              <Icon name="upload" size={14} /> {busy ? "Processing…" : label}
            </button>
            {(value || current) && (
              <button
                type="button"
                onClick={() => {
                  setRemoved(true);
                  setValue("");
                  setError(null);
                }}
                style={{
                  padding: "7px 12px",
                  border: "1px solid var(--error)",
                  background: "var(--surface)",
                  color: "var(--error)",
                  borderRadius: 8,
                  cursor: "pointer",
                  fontWeight: 700,
                  fontSize: 12.5,
                }}
              >
                Remove
              </button>
            )}
          </div>
          <span style={{ fontSize: 11, color: "var(--text-faint)" }}>JPG or PNG, up to 5 MB. Crop & rotate before uploading.</span>
        </div>
      </div>
      {error && <p style={{ fontSize: 12, color: "var(--error)", margin: "8px 0 0" }}>{error}</p>}

      {editing && (
        <div
          style={{
            marginTop: 14,
            background: "var(--surface-muted)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius)",
            padding: 14,
          }}
        >
          <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 10 }}>Crop & align your photo</div>
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap", alignItems: "flex-start" }}>
            <div
              data-cropbox
              style={{ position: "relative", width: BOX, height: BOX, overflow: "hidden", background: "#0b1220", borderRadius: 8, touchAction: "none", userSelect: "none" }}
              onPointerMove={onPreviewPointerMove}
              onPointerUp={endDrag}
              onPointerLeave={endDrag}
            >
              {fit && (
                <img
                  src={editing}
                  alt=""
                  style={{
                    position: "absolute",
                    left: fit.ox,
                    top: fit.oy,
                    width: fit.w,
                    height: fit.h,
                    transform: `rotate(${rotation * 90}deg)`,
                    transformOrigin: "center center",
                  }}
                />
              )}
              {crop && fit && (
                <div
                  style={{
                    position: "absolute",
                    left: crop.x,
                    top: crop.y,
                    width: crop.size,
                    height: crop.size,
                    border: "2px solid #fff",
                    borderRadius: 4,
                    boxShadow: "0 0 0 4000px rgba(0,0,0,0.45)",
                    cursor: "move",
                    touchAction: "none",
                  }}
                  onPointerDown={(e) => onBoxPointerDown(e, "move")}
                >
                  <div
                    style={{
                      position: "absolute",
                      right: -6,
                      bottom: -6,
                      width: 14,
                      height: 14,
                      background: "#fff",
                      borderRadius: 4,
                      border: "2px solid var(--secondary)",
                      cursor: "nwse-resize",
                    }}
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      onBoxPointerDown(e, "resize");
                    }}
                  />
                </div>
              )}
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ display: "flex", gap: 6 }}>
                <button type="button" onClick={() => rotate(-1)} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 12px", border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text)", borderRadius: 8, cursor: "pointer", fontWeight: 700, fontSize: 12 }}>
                  <Icon name="rotate" size={14} /> Rotate left
                </button>
                <button type="button" onClick={() => rotate(1)} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 12px", border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text)", borderRadius: 8, cursor: "pointer", fontWeight: 700, fontSize: 12 }}>
                  Rotate right <Icon name="rotate" size={14} style={{ transform: "scaleX(-1)" }} />
                </button>
              </div>
              <p style={{ fontSize: 11, color: "var(--text-faint)", margin: 0 }}>Drag the box to frame the photo. Use the corner handle to resize. The result is cropped to a square.</p>
              <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
                <button
                  type="button"
                  onClick={confirmCrop}
                  disabled={busy}
                  style={{ padding: "8px 16px", background: "var(--primary)", color: "#fff", border: "none", borderRadius: 8, fontWeight: 700, fontSize: 12.5, cursor: "pointer" }}
                >
                  Apply crop
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEditing(null);
                    setCrop(null);
                    setFit(null);
                    setRotation(0);
                  }}
                  style={{ padding: "8px 16px", background: "var(--surface)", color: "var(--text-muted)", border: "1px solid var(--border)", borderRadius: 8, fontWeight: 700, fontSize: 12.5, cursor: "pointer" }}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        onChange={(e) => onFile(e.target.files?.[0])}
        style={{ display: "none" }}
      />
    </div>
  );
}