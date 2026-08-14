"use client";

// Upload a photo from the device and put the result into the surrounding
// form as a hidden field. The image is read client-side, downscaled to a
// small square-ish JPEG data URL, and written to a hidden input so the
// existing server actions keep working with a plain `photoUrl` string.
//
// Usage: render inside a <form> that submits to a server action, and read
// `name` (default "photoUrl") from the FormData as before.

import { useEffect, useRef, useState } from "react";
import { Avatar } from "./Avatar";
import { Icon } from "./Icon";

const MAX_FILE_BYTES = 5 * 1024 * 1024; // 5 MB
const MAX_DIMENSION = 256;

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

async function downscale(dataUrl: string): Promise<string> {
  const img = await loadImage(dataUrl);
  const scale = Math.min(1, MAX_DIMENSION / Math.max(img.width, img.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(img.width * scale));
  canvas.height = Math.max(1, Math.round(img.height * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) return dataUrl;
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.85);
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
  const fileRef = useRef<HTMLInputElement>(null);

  // After a save+redirect the server may pass back a fresh `current`;
  // reflect it so the preview matches what's actually stored.
  useEffect(() => {
    if (!removed) setValue(current ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current]);

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
      const downscaled = await downscale(raw);
      setValue(downscaled);
      setRemoved(false);
    } catch (e) {
      setError((e as Error).message || "Could not read that image.");
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
          <span style={{ fontSize: 11, color: "var(--text-faint)" }}>JPG or PNG, up to 5 MB. Scaled to a small profile size.</span>
        </div>
      </div>
      {error && <p style={{ fontSize: 12, color: "var(--error)", margin: "8px 0 0" }}>{error}</p>}
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