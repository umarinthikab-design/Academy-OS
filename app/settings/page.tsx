import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/getSession";
import { redirect } from "next/navigation";
import { StatusBanner } from "@/components/StatusBanner";
import { updateProfile, changePassword } from "./actions";
import { PageHeader } from "@/components/ui/PageHeader";
import { Avatar } from "@/components/ui/Avatar";
import { inputBase } from "@/components/ui/Form";
import { roleLabel } from "@/lib/roleLabel";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { NotificationToggle } from "@/components/NotificationToggle";
import { PhotoUpload } from "@/components/ui/PhotoUpload";
import { PasswordField } from "@/components/ui/PasswordField";

const ERROR_MESSAGES: Record<string, string> = {
  missing_fields: "Please fill in all required fields.",
  password_too_short: "New password must be at least 8 characters.",
  password_mismatch: "New password and confirmation don't match.",
  wrong_password: "Current password is incorrect.",
};

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string }>;
}) {
  const p = await searchParams;
  const session = await getSession();
  if (!session) redirect("/login");

  const user = await prisma.user.findUnique({ where: { id: session.userId } });
  if (!user) redirect("/login");

  const card: React.CSSProperties = {
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius-lg)",
    boxShadow: "var(--shadow-sm)",
    padding: 24,
  };

  const labelCaps: React.CSSProperties = {
    fontFamily: "var(--font-mono-label)",
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: "0.06em",
    textTransform: "uppercase",
    color: "var(--text-muted)",
    display: "block",
    marginBottom: 6,
  };

  return (
    <>
      <PageHeader title="Settings" subtitle="Manage your personal preferences and account security." />

      <StatusBanner error={p.error ? ERROR_MESSAGES[p.error] ?? p.error : undefined} success={p.success} />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(12, 1fr)", gap: 16, alignItems: "start" }}>
        <section style={{ ...card, gridColumn: "span 8", display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <Avatar name={user.name} src={user.photoUrl} size={72} style={{ border: "2px solid var(--border)" }} />
            <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
              <div style={{ fontWeight: 800, color: "var(--primary)", fontSize: 15 }}>{user.name}</div>
              <div>{user.email}</div>
              <div>{roleLabel(user.role)}</div>
            </div>
          </div>

          <form action={updateProfile} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div>
              <label style={labelCaps}>Full Name</label>
              <input name="name" defaultValue={user.name} required style={inputBase} />
            </div>
            <div>
              <label style={labelCaps}>Profile Photo</label>
              <PhotoUpload name="photoUrl" current={user.photoUrl} label="Upload from device" />
            </div>
            <button type="submit" style={{ alignSelf: "flex-start", padding: "9px 22px", background: "var(--primary)", color: "#fff", border: "none", borderRadius: 8, fontWeight: 700, cursor: "pointer", boxShadow: "var(--shadow-sm)" }}>
              Save profile
            </button>
          </form>
        </section>

        <section style={{ ...card, gridColumn: "span 4", display: "flex", flexDirection: "column", justifyContent: "space-between", minHeight: 180 }}>
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 600, color: "var(--primary)" }}>Appearance</h2>
            <p style={{ fontSize: 14, color: "var(--text-muted)", margin: "6px 0 16px", lineHeight: 1.5 }}>Select your preferred viewing mode. Saved to your account.</p>
          </div>
          <ThemeToggle theme={user.theme} />
        </section>

        <section style={{ ...card, gridColumn: "span 12", display: "flex", flexDirection: "column", gap: 4 }}>
          <h2 style={{ fontSize: 20, fontWeight: 600, color: "var(--primary)" }}>Notifications</h2>
          <p style={{ fontSize: 14, color: "var(--text-muted)", margin: "6px 0 10px", lineHeight: 1.5 }}>
            Push notifications for drill suggestions awaiting your approval and session confirmations you haven't answered yet.
          </p>
          <NotificationToggle />
        </section>

        <section style={{ ...card, gridColumn: "span 12" }}>
          <h2 style={{ fontSize: 20, fontWeight: 600, color: "var(--primary)", marginBottom: 4 }}>Change password</h2>
          <p style={{ fontSize: 14, color: "var(--text-muted)", margin: "0 0 20px" }}>You'll stay signed in on this device; all other sessions are signed out.</p>
          <form action={changePassword} style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 520 }}>
            <div>
              <label style={labelCaps}>Current Password</label>
              <PasswordField name="currentPassword" required autoComplete="current-password" />
            </div>
            <div>
              <label style={labelCaps}>New Password</label>
              <PasswordField name="newPassword" required minLength={8} autoComplete="new-password" />
            </div>
            <div>
              <label style={labelCaps}>Confirm New Password</label>
              <PasswordField name="confirmPassword" required minLength={8} autoComplete="new-password" />
            </div>
            <button type="submit" style={{ alignSelf: "flex-start", padding: "9px 22px", background: "var(--primary)", color: "#fff", border: "none", borderRadius: 8, fontWeight: 700, cursor: "pointer", boxShadow: "var(--shadow-sm)" }}>
              Change password
            </button>
          </form>
        </section>
      </div>
    </>
  );
}