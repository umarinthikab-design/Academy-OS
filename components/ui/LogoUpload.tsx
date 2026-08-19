"use client";

// Club logo uploader for the academy branding settings. Unlike the square
// avatar PhotoUpload, this keeps the original aspect ratio (horizontal
// lockups and square badges both work), preserves PNG transparency, and
// keeps a higher resolution (up to 1024px) so the logo stays crisp when it
// is shown large on the login screen, sidebar, and mobile drawer. Selected
// images are downscaled client-side, uploaded to the Vercel Blob-backed
// /api/upload-photo route (folder=logos), and the returned public URL is
// written to a hidden input named `name` (default "logoUrl") so the
// surrounding server-action form reads it as a plain string.

import { useEffect, useRef, useState } from "react";
import { Icon } from "./Icon";

const MAX_FILE_BYTES = 15 * 1024 * 1024; // 15 MB
const MAX_DIMENSION = 1024;

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

async function uploadImage(dataUrl: string, type: string): Promise<string> {
  const blob = await (await fetch(dataUrl)).blob();
  const file = new File([blob], type === "image/png" ? "logo.png" : "logo.jpg", { type });
  const form = new FormData();
  form.set("file", file);
  form.set("folder", "logos");
  const res = await fetch("/api/upload-photo", {
    method: "POST",
    body: form,
  });
  if (!res.ok) {
    let message = "Upload failed.";
    try {
      const body = await res.json();
      if (body?.error) message = `Upload failed (${body.error}).`;
    } catch {}
    throw new Error(message);
  }
  const body = await res.json();
  return body.url as string;
}

// Downscale to fit inside MAX_DIMENSION while keeping the aspect ratio.
// PNG/WebP sources keep their alpha channel; everything else becomes a
// high-quality JPEG.
function process(raw: string, fileType: string): Promise<{ dataUrl: string; outType: string }> {
  return loadImage(raw).then((img) => {
    const scale = Math.min(1, MAX_DIMENSION / img.width, MAX_DIMENSION / img.height);
    const w = Math.max(1, Math.round(img.width * scale));
    const h = Math.max(1, Math.round(img.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Could not process that image.");
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, 0, 0, w, h);
    const outType = fileType === "image/png" || fileType === "image/webp" ? "image/png" : "image/jpeg";
    return { dataUrl: canvas.toDataURL(outType, outType === "image/png" ? undefined : 0.9), outType };
  });
}

export function LogoUpload({
  name = "logoUrl",
  current,
}: {
  name?: string;
  current?: string | null;
}) {
  const [value, setValue] = useState<string>(current ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setValue(current ?? "");
  }, [current]);

  const onFile = async (file?: File | null) => {
    if (!file) return;
    setError(null);
    if (!file.type.startsWith("image/")) {
      setError("Please choose an image file (PNG, JPG, etc).");
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      setError("Image is too large — max 15 MB.");
      return;
    }
    setBusy(true);
    try {
      const raw = await readFile(file);
      const { dataUrl, outType } = await process(raw, file.type);
      const url = await uploadImage(dataUrl, outType);
      setValue(url);
    } catch (e) {
      setError((e as Error).message || "Could not read that image.");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <div>
      <input type="hidden" name={name} value={value} />
      <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
        <div
          style={{
            width: 84,
            height: 84,
            borderRadius: 10,
            border: "1px solid var(--border)",
            background:
              "repeating-conic-gradient(var(--surface-muted) 0% 25%, var(--surface) 0% 50%) 50% / 14px 14px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden",
            flexShrink: 0,
          }}
        >
          {value ? (
            <img src={value} alt="" style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain", display: "block" }} />
          ) : (
            <span style={{ fontSize: 11, color: "var(--text-faint)" }}>No logo</span>
          )}
        </div>
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
              <Icon name="upload" size={14} /> {busy ? "Uploading…" : value ? "Replace logo" : "Upload logo"}
            </button>
            {value && (
              <button
                type="button"
                onClick={() => {
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
          <span style={{ fontSize: 11, color: "var(--text-faint)" }}>
            PNG or JPG, up to 15 MB. Transparency is kept and the logo is stored at up to 1024px for crisp display.
          </span>
        </div>
      </div>
      {error && <p style={{ fontSize: 12, color: "var(--error)", margin: "8px 0 0" }}>{error}</p>}

      <input
        ref={fileRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif,image/avif"
        onChange={(e) => onFile(e.target.files?.[0])}
        style={{ display: "none" }}
      />
    </div>
  );
}