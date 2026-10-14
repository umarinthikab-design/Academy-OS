export const SQUAD_RETURN_KEY = "touchline-squad-return";
export function safeSquadReturn(raw: unknown): string {
  if (typeof raw !== "string" || !raw.startsWith("/squad") || /[\\\r\n]/.test(raw)) return "/squad";
  try {
    const url = new URL(raw, "https://squad.invalid");
    return url.origin === "https://squad.invalid" && url.pathname === "/squad" ? url.pathname + url.search + url.hash : "/squad";
  } catch { return "/squad"; }
}
