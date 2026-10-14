// Shared handling for profile/player photo fields. Photos come from the
// client-side PhotoUpload component as base64 data URLs (downscaled on
// device) or as plain https URLs. This sanitizer keeps the stored value
// predictable and caps the size so the DB doesn't balloon.

const MAX_PHOTO_DATA_URL_BYTES = 256 * 1024;

export function sanitizePhotoUrl(raw: string | null): string | null {
  if (!raw || !raw.trim()) return null;
  const value = raw.trim();
  if (value.startsWith("data:image/")) {
    if (value.length > MAX_PHOTO_DATA_URL_BYTES || !/^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(value)) return null;
    return value;
  }
  if (value.startsWith("https://")) return value;
  return null;
}