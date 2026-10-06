export function safeEqual(a: string, b: string): boolean {
  // Constant-time comparison using crypto.timingSafeEqual when available.
  // When lengths differ, it returns false without throwing.
  // Falls back to simple equality if the native API is unavailable.
  if (typeof crypto !== "undefined" && typeof (crypto as any).timingSafeEqual === "function") {
    try {
      const buf_a = Buffer.from(a, "utf8");
      const buf_b = Buffer.from(b, "utf8");
      return (crypto as any).timingSafeEqual(buf_a, buf_b);
    } catch {
      // If Buffer or timingSafeEqual fails for any reason, fall through to fallback.
    }
  }
  // Fallback: simple equality.
  return a === b;
}