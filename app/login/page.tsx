import { login } from "./actions";

const ERROR_MESSAGES: Record<string, string> = {
  "1": "Incorrect email or password.",
  rate_limited: "Too many failed attempts. Try again in 15 minutes.",
  session_revoked: "Your session was signed out. Please log in again.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;

  return (
    <main
      style={{
        maxWidth: 360,
        margin: "80px auto",
        padding: "0 20px",
      }}
    >
      <div
        style={{
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: "0.1em",
          color: "var(--turf)",
          textAlign: "center",
        }}
      >
        GRASSROOTS COACHING
      </div>
      <h1 style={{ fontSize: 28, margin: "4px 0 24px", textTransform: "uppercase", textAlign: "center" }}>
        Touchline
      </h1>

      <form
        action={login}
        style={{
          background: "#fff",
          border: "2px solid var(--pitch)",
          borderRadius: 12,
          padding: 20,
        }}
      >
        {params.error && (
          <div style={{ background: "#FEE2E2", color: "#991B1B", padding: 10, borderRadius: 6, marginBottom: 14, fontSize: 13 }}>
            {ERROR_MESSAGES[params.error] || "Something went wrong. Please try again."}
          </div>
        )}

        <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 4 }}>Email</label>
        <input
          name="email"
          type="email"
          required
          style={{ width: "100%", padding: 8, marginBottom: 12, border: "1px solid #d1d5db", borderRadius: 6, boxSizing: "border-box" }}
        />

        <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 4 }}>Password</label>
        <input
          name="password"
          type="password"
          required
          style={{ width: "100%", padding: 8, marginBottom: 16, border: "1px solid #d1d5db", borderRadius: 6, boxSizing: "border-box" }}
        />

        <button
          type="submit"
          style={{ width: "100%", padding: 10, background: "var(--pitch)", color: "#fff", border: "none", borderRadius: 6, fontWeight: 700, cursor: "pointer" }}
        >
          Log In
        </button>
      </form>
    </main>
  );
}
