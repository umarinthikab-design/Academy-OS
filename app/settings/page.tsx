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

  const sectionStyle: React.CSSProperties = {
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius)",
    boxShadow: "var(--shadow-sm)",
    padding: 18,
    marginBottom: 20,
  };

  return (
    <>
      <PageHeader title="Settings" subtitle="Your account details. A profile photo is optional." />

      <StatusBanner error={p.error ? ERROR_MESSAGES[p.error] ?? p.error : undefined} success={p.success} />

      <section style={sectionStyle}>
        <h2 style={{ fontSize: 16, margin: "0 0 12px" }}>Profile</h2>
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 16 }}>
          <Avatar name={user.name} src={user.photoUrl} size={72} />
          <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
            <div style={{ fontWeight: 800, color: "var(--primary)", fontSize: 15 }}>{user.name}</div>
            <div>{user.email}</div>
            <div>{roleLabel(user.role)}</div>
          </div>
        </div>

        <form action={updateProfile} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 4 }}>Name</label>
            <input name="name" defaultValue={user.name} required style={inputBase} />
          </div>
          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 4 }}>Profile photo</label>
            <PhotoUpload name="photoUrl" current={user.photoUrl} label="Upload from device" />
          </div>
          <button type="submit" style={{ alignSelf: "flex-start", padding: "9px 18px", background: "var(--primary)", color: "#fff", border: "none", borderRadius: 8, fontWeight: 700, cursor: "pointer" }}>
            Save profile
          </button>
        </form>
      </section>

      <section style={sectionStyle}>
        <h2 style={{ fontSize: 16, margin: "0 0 4px" }}>Appearance</h2>
        <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "0 0 14px" }}>Choose how Touchline looks on this device. Saved to your account.</p>
        <ThemeToggle theme={user.theme} />
      </section>

      <section style={sectionStyle}>
        <h2 style={{ fontSize: 16, margin: "0 0 4px" }}>Change password</h2>
        <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "0 0 14px" }}>You'll stay signed in on this device; all other sessions are signed out.</p>
        <form action={changePassword} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 4 }}>Current password</label>
            <PasswordField name="currentPassword" required autoComplete="current-password" />
          </div>
          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 4 }}>New password</label>
            <PasswordField name="newPassword" required minLength={8} autoComplete="new-password" />
          </div>
          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 4 }}>Confirm new password</label>
            <PasswordField name="confirmPassword" required minLength={8} autoComplete="new-password" />
          </div>
          <button type="submit" style={{ alignSelf: "flex-start", padding: "9px 18px", background: "var(--primary)", color: "#fff", border: "none", borderRadius: 8, fontWeight: 700, cursor: "pointer" }}>
            Change password
          </button>
        </form>
      </section>
    </>
  );
}