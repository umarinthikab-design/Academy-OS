"use client";

// Multi-photo uploader for drills. Unlike the avatar PhotoUpload this keeps
// the original aspect ratio (drill diagrams shouldn't be cropped to squares)
// and allows more than one photo. Selected photos are downscaled client-side
// and written as hidden inputs named `name` (multiple) so the surrounding
// server-action form reads them with formData.getAll(name) - same storage
// approach as Player.photoUrl (base64 data URLs).

import { useRef, useState } from "react";
import { Icon } from "./Icon";

const MAX_FILE_BYTES = 5 * 1024 * 1024; // 5 MB
const MAX_DIMENSION = 512;

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

// Downscale to fit inside MAX_DIMENSION while keeping the aspect ratio.
async function downscale(raw: string): Promise<string> {
  const img = await loadImage(raw);
  const scale = Math.min(1, MAX_DIMENSION / img.width, MAX_DIMENSION / img.height);
  const w = Math.max(1, Math.round(img.width * scale));
  const h = Math.max(1, Math.round(img.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return raw;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, 0, 0, w, h);
  return canvas.toDataURL("image/jpeg", 0.82);
}

export function DrillPhotoUpload({
  name = "photoUrls",
  current = [],
  label = "Add photos",
}: {
  name?: string;
  current?: string[];
  label?: string;
}) {
  const [photos, setPhotos] = useState<string[]>(current);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const onFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setError(null);
    setBusy(true);
    try {
      const next: string[] = [];
      for (const file of Array.from(files)) {
        if (!file.type.startsWith("image/")) {
          setError("Please choose image files (JPG, PNG, etc).");
          continue;
        }
        if (file.size > MAX_FILE_BYTES) {
          setError("One of the images is too large — max 5 MB each.");
          continue;
        }
        const raw = await readFile(file);
        next.push(await downscale(raw));
      }
      setPhotos((prev) => [...prev, ...next]);
    } catch (e) {
      setError((e as Error).message || "Could not read that image.");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const remove = (index: number) => setPhotos((prev) => prev.filter((_, i) => i !== index));

  return (
    <div>
      {photos.map((url, i) => (
        <input key={`${url.slice(0, 24)}-${i}`} type="hidden" name={name} value={url} />
      ))}

      {photos.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
          {photos.map((url, i) => (
            <div
              key={i}
              style={{
                position: "relative",
                width: 72,
                height: 72,
                borderRadius: 8,
                overflow: "hidden",
                border: "1px solid var(--border)",
                background: "var(--surface-muted)",
              }}
            >
              <img src={url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
              <button
                type="button"
                onClick={() => remove(i)}
                title="Remove photo"
                style={{
                  position: "absolute",
                  top: 3,
                  right: 3,
                  width: 20,
                  height: 20,
                  borderRadius: "50%",
                  border: "none",
                  background: "rgba(0,0,0,0.6)",
                  color: "#fff",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: 0,
                }}
              >
                <Icon name="close" size={12} />
              </button>
            </div>
          ))}
        </div>
      )}

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
        {photos.length > 0 && <span style={{ fontSize: 11, color: "var(--text-muted)" }}>({photos.length})</span>}
      </button>
      <span style={{ fontSize: 11, color: "var(--text-faint)", marginLeft: 8 }}>JPG or PNG, up to 5 MB each. More than one photo allowed.</span>

      {error && <p style={{ fontSize: 12, color: "var(--error)", margin: "8px 0 0" }}>{error}</p>}

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        multiple
        onChange={(e) => onFiles(e.target.files)}
        style={{ display: "none" }}
      />
    </div>
  );
}
