import { getSession } from "@/lib/getSession";
import { redirect } from "next/navigation";
import { changePasswordOnFirstLogin } from "./actions";
import { PasswordField } from "@/components/ui/PasswordField";
import { Icon } from "@/components/ui/Icon";

const ERROR_MESSAGES: Record<string, string> = {
  password_too_short: "New password must be at least 8 characters.",
  password_mismatch: "Passwords don't match.",
};

export default async function ChangePasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  const session = await getSession();
  if (!session) redirect("/login");

  return (
    <main style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "0 20px", background: "var(--bg)" }}>
      <div style={{ maxWidth: 420, width: "100%" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 20 }}>
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
              marginBottom: 12,
              boxShadow: "var(--shadow-md)",
            }}
          >
            <Icon name="shield" size={28} />
          </div>
          <h1 style={{ fontSize: 24, margin: 0, fontWeight: 800 }}>Set your password</h1>
        </div>

        <form
          action={changePasswordOnFirstLogin}
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-lg)",
            boxShadow: "var(--shadow-md)",
            padding: 26,
          }}
        >
          {params.error && (
            <div style={{ background: "var(--error-bg)", color: "#b91c1c", border: "1px solid #fecaca", padding: 10, borderRadius: 8, marginBottom: 14, fontSize: 13, fontWeight: 600 }}>
              {ERROR_MESSAGES[params.error] || "Something went wrong. Please try again."}
            </div>
          )}

          <p style={{ fontSize: 13, color: "var(--text-muted)", margin: "0 0 16px" }}>
            An administrator gave you this account. Before you can use Touchline, pick a password only you know — at least 8 characters.
          </p>

          <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 4 }}>New password</label>
          <PasswordField name="newPassword" required minLength={8} autoComplete="new-password" style={{ marginBottom: 14 }} />

          <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 4 }}>Confirm new password</label>
          <PasswordField name="confirmPassword" required minLength={8} autoComplete="new-password" style={{ marginBottom: 18 }} />

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
            }}
          >
            Save password and continue
          </button>
        </form>
      </div>
    </main>
  );
}