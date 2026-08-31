import { login } from "./actions";
import { Icon } from "@/components/ui/Icon";
import { PasswordField } from "@/components/ui/PasswordField";
import { PitchLines } from "@/components/ui/PitchLines";
import { getAcademyBranding } from "@/lib/getAcademyBranding";

const ERROR_MESSAGES: Record<string, string> = {
  "1": "Incorrect email or password.",
  rate_limited: "Too many failed attempts. Try again in 15 minutes.",
  session_revoked: "Your session was signed out. Please log in again.",
  account_archived: "This account has been archived. Contact an administrator.",
};

// Login per the Stitch export: full-bleed primary-container backdrop with the
// chalk-line pitch watermark, one centered card (header strip / form / footer
// strip). The academy name stays the dominant wordmark; Touchline remains as
// the small "Powered by" line.
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  const { academyName, logoUrl } = await getAcademyBranding();

  const fieldLabel = {
    display: "block",
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    color: "var(--text-muted)",
    marginBottom: 6,
    fontFamily: "var(--font-mono-label)",
  } as const;

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px 16px",
        background: "var(--primary-container)",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <PitchLines />

      <div
        style={{
          position: "relative",
          maxWidth: 420,
          width: "100%",
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius-lg)",
          boxShadow: "var(--shadow-lg)",
          overflow: "hidden",
        }}
      >
        {/* Card header — academy wordmark */}
        <div
          style={{
            padding: "32px 28px 22px",
            textAlign: "center",
            borderBottom: "1px solid var(--border)",
            background: "var(--surface-muted)",
          }}
        >
          {logoUrl ? (
            <img
              src={logoUrl}
              alt=""
              style={{ maxWidth: 200, maxHeight: 64, objectFit: "contain", margin: "0 auto 10px", display: "block" }}
            />
          ) : (
            <div
              style={{
                width: 52,
                height: 52,
                borderRadius: "50%",
                background: "var(--primary-container)",
                color: "#fff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 10px",
              }}
            >
              <Icon name="football" size={26} style={{ color: "var(--accent)" }} />
            </div>
          )}
          <h1
            style={{
              fontFamily: "var(--font-headline)",
              fontSize: 32,
              fontWeight: 700,
              lineHeight: 1.15,
              letterSpacing: "-0.01em",
              color: "var(--primary)",
              margin: 0,
            }}
          >
            {academyName}
          </h1>
          <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 4 }}>Powered by Touchline</div>
        </div>

        {/* Form */}
        <form action={login} style={{ padding: 28 }}>
          {params.error && (
            <div
              style={{
                background: "var(--error-bg)",
                color: "#b91c1c",
                border: "1px solid #fecaca",
                padding: 10,
                borderRadius: 8,
                marginBottom: 16,
                fontSize: 13,
                fontWeight: 600,
              }}
            >
              {ERROR_MESSAGES[params.error] || "Something went wrong. Please try again."}
            </div>
          )}

          <label style={fieldLabel}>Email address</label>
          <input
            name="email"
            type="email"
            required
            autoComplete="email"
            placeholder="coach@academy.com"
            style={{
              width: "100%",
              padding: "10px 12px",
              marginBottom: 16,
              border: "1px solid var(--border)",
              borderRadius: 8,
              boxSizing: "border-box",
              fontSize: 14,
              background: "var(--surface)",
              color: "var(--text)",
              transition: "border-color var(--transition), box-shadow var(--transition)",
            }}
          />

          <label style={fieldLabel}>Password</label>
          <PasswordField
            name="password"
            required
            autoComplete="current-password"
            style={{ marginBottom: 22 }}
          />

          <button
            type="submit"
            style={{
              width: "100%",
              padding: "12px 12px",
              background: "var(--secondary)",
              color: "#fff",
              border: "none",
              borderRadius: 8,
              fontWeight: 600,
              fontSize: 15,
              cursor: "pointer",
              transition: "background var(--transition), transform var(--transition)",
            }}
          >
            Log In to Touchline
          </button>
        </form>

        {/* Footer strip */}
        <div
          style={{
            background: "var(--surface-muted)",
            padding: "14px 28px",
            textAlign: "center",
            borderTop: "1px solid var(--border)",
            fontSize: 12,
            color: "var(--text-faint)",
          }}
        >
          Need access? Contact your academy administrator.
        </div>
      </div>
    </main>
  );
}