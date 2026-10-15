import { Button } from "@/components/ui/Button";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/getSession";
import { redirect } from "next/navigation";
import { StatusBanner } from "@/components/StatusBanner";
import { updateProfile, changePassword } from "./actions";
import { PageHeader } from "@/components/ui/PageHeader";
import { SettingsSection } from "@/components/ui/SettingsSection";
import { Avatar } from "@/components/ui/Avatar";
import { inputBase } from "@/components/ui/Form";
import { roleLabel } from "@/lib/roleLabel";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { NotificationToggle } from "@/components/NotificationToggle";
import { PhotoUpload } from "@/components/ui/PhotoUpload";
import { PasswordField } from "@/components/ui/PasswordField";

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

  const labelCaps: React.CSSProperties = {
    fontFamily: "var(--font-mono-label)",
    fontSize: 13,
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

      <StatusBanner error={p.error} success={p.success} />

      <div style={{ display: "flex", flexDirection: "column", gap: 20, maxWidth: 900 }}>
        <SettingsSection title="Profile">
          <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 20 }}>
            <Avatar name={user.name} src={user.photoUrl} size={72} style={{ border: "2px solid var(--border)" }} />
            <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
              <div style={{ fontWeight: 800, color: "var(--text-heading)", fontSize: 15 }}>{user.name}</div>
              <div>{user.email}</div>
              <div>{roleLabel(user.role)}</div>
            </div>
          </div>

          <form action={updateProfile} style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 520 }}>
            <div>
              <label style={labelCaps}>Full Name</label>
              <input name="name" defaultValue={user.name} required style={inputBase} />
            </div>
            <div>
              <label style={labelCaps}>Profile Photo</label>
              <PhotoUpload name="photoUrl" current={user.photoUrl} label="Upload from device" />
            </div>
            <Button style={{ alignSelf: "flex-start" }}>Save profile</Button>
          </form>
        </SettingsSection>

        <SettingsSection title="Appearance" description="Select your preferred viewing mode. Saved to your account.">
          <ThemeToggle theme={user.theme} />
        </SettingsSection>

        <SettingsSection
          title="Notifications"
          description="Push notifications for drill suggestions awaiting your approval and session confirmations you haven't answered yet."
        >
          <NotificationToggle />
        </SettingsSection>

        <SettingsSection
          title="Change password"
          description="You'll stay signed in on this device; all other sessions are signed out."
        >
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
            <Button style={{ alignSelf: "flex-start" }}>Change password</Button>
          </form>
        </SettingsSection>
      </div>
    </>
  );
}
