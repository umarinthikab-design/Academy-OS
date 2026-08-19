import { login } from "./actions";
import { Icon } from "@/components/ui/Icon";
import { PasswordField } from "@/components/ui/PasswordField";
import { getAcademyBranding } from "@/lib/getAcademyBranding";

const ERROR_MESSAGES: Record<string, string> = {
  "1": "Incorrect email or password.",
  rate_limited: "Too many failed attempts. Try again in 15 minutes.",
  session_revoked: "Your session was signed out. Please log in again.",
  account_archived: "This account has been archived. Contact an administrator.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  const { academyName, logoUrl } = await getAcademyBranding();

  return (
    <main style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "0 20px", background: "var(--bg)" }}>
      <div style={{ maxWidth: 400, width: "100%" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 24 }}>
          {logoUrl ? (
            <img
              src={logoUrl}
              alt={academyName}
              style={{ maxWidth: 220, maxHeight: 72, objectFit: "contain", marginBottom: 14 }}
            />
          ) : (
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: 16,
                background: "linear-gradient(135deg, var(--primary-dark), var(--primary))",
                color: "#fff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: 14,
                boxShadow: "var(--shadow-md)",
              }}
            >
              <Icon name="football" size={28} />
            </div>
          )}
          <h1 style={{ fontSize: 30, margin: 0, textAlign: "center", fontWeight: 800, letterSpacing: "-0.02em" }}>
            {academyName}
          </h1>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", color: "var(--text-muted)", textTransform: "uppercase", marginTop: 6 }}>
            Powered by Touchline
          </div>
        </div>

        <form
          action={login}
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-lg)",
            boxShadow: "var(--shadow-md)",
            padding: 28,
          }}
        >
          {params.error && (
            <div style={{ background: "var(--error-bg)", color: "#b91c1c", border: "1px solid #fecaca", padding: 10, borderRadius: 8, marginBottom: 14, fontSize: 13, fontWeight: 600 }}>
              {ERROR_MESSAGES[params.error] || "Something went wrong. Please try again."}
            </div>
          )}

          <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 4 }}>Email</label>
          <input
            name="email"
            type="email"
            required
            autoComplete="email"
            style={{ width: "100%", padding: "10px 12px", marginBottom: 14, border: "1px solid var(--border)", borderRadius: 8, boxSizing: "border-box", fontSize: 14, background: "var(--surface)", color: "var(--text)", transition: "border-color var(--transition), box-shadow var(--transition)" }}
          />

          <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 4 }}>Password</label>
          <PasswordField
            name="password"
            required
            autoComplete="current-password"
            style={{ marginBottom: 18 }}
          />

          <button
            type="submit"
            style={{
              width: "100%",
              padding: "11px 12px",
              background: "var(--primary)",
              color: "#fff",
              border: "none",
              borderRadius: 8,
              fontWeight: 700,
              fontSize: 14,
              cursor: "pointer",
              transition: "background var(--transition), transform var(--transition)",
            }}
          >
            Log In
          </button>
        </form>

        <p style={{ textAlign: "center", fontSize: 12, color: "var(--text-faint)", marginTop: 18 }}>
          Touchline · Football Academy Management
        </p>
      </div>
    </main>
  );
}