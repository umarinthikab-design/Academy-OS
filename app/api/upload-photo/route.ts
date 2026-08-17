// Upload route for photos - receives a cropped image from the client-side
// PhotoUpload, stores it in Vercel Blob, and returns the public URL to save
// into Player.photoUrl / User.photoUrl. Requires a logged-in session (so this
// is never an open/unauthenticated upload endpoint); the surrounding save
// actions enforce their own finer gates (e.g. squad-edit for player photos).
// PhotoUpload is shared by the player forms and the Settings page (where any
// user updates their own avatar), hence the session-only gate here.

import { NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { getSession } from "@/lib/getSession";

export const runtime = "nodejs";

const MAX_FILE_BYTES = 5 * 1024 * 1024; // 5 MB
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

  // The client already sends a downscaled square JPEG, but keep the stored
  // content type + extension honest in case something slips through.
  const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : file.type === "image/gif" ? "gif" : file.type === "image/avif" ? "avif" : "jpg";
  const key = `players/${crypto.randomUUID()}.${ext}`;

  const blob = await put(key, file, {
    access: "public",
    addRandomSuffix: false,
    contentType: file.type,
  });

  return NextResponse.json({ url: blob.url });
}