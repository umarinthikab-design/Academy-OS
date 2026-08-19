// Upload route for photos and club logos - receives a processed image from
// the client-side PhotoUpload / LogoUpload components, stores it in Vercel
// Blob, and returns the public URL to save into Player.photoUrl /
// User.photoUrl / AcademySettings.logoUrl. Requires a logged-in session (so
// this is never an open/unauthenticated upload endpoint); the surrounding
// save actions enforce their own finer gates (e.g. squad-edit for player
// photos, admin/CM for the club logo).
//
// The size cap is generous (15 MB) because the logo uploader keeps a
// higher-resolution PNG/JPEG for crisp branding; the avatar PhotoUpload
// still enforces its own tighter 5 MB / 256px client-side limits.

import { NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { getSession } from "@/lib/getSession";

export const runtime = "nodejs";

const MAX_FILE_BYTES = 15 * 1024 * 1024; // 15 MB
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"]);

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "missing_file" }, { status: 400 });
  }

  if (!ALLOWED_TYPES.has(file.type)) {
    return NextResponse.json({ error: "unsupported_type" }, { status: 400 });
  }
  if (file.size > MAX_FILE_BYTES) {
    return NextResponse.json({ error: "file_too_large" }, { status: 400 });
  }

  const folder = form.get("folder") === "logos" ? "logos" : "players";

  // The client already sends a processed image, but keep the stored content
  // type + extension honest in case something slips through.
  const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : file.type === "image/gif" ? "gif" : file.type === "image/avif" ? "avif" : "jpg";
  const key = `${folder}/${crypto.randomUUID()}.${ext}`;

  const blob = await put(key, file, {
    access: "public",
    addRandomSuffix: false,
    contentType: file.type,
  });

  return NextResponse.json({ url: blob.url });
}