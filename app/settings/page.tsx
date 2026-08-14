import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/getSession";
import { redirect } from "next/navigation";
import { StatusBanner } from "@/components/StatusBanner";
import { updateProfile, changePassword } from "./actions";

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

  return (
    <main style={{ maxWidth: 720, margin: "0 auto", padding: "40px 20px" }}>
      <h1 style={{ fontSize: 28, margin: "8px 0 4px" }}>Settings</h1>
      <p style={{ fontSize: 13, color: "#6B7280", margin: "0 0 20px" }}>Your account details. A profile photo is optional.</p>

      <StatusBanner error={p.error ? ERROR_MESSAGES[p.error] ?? p.error : undefined} success={p.success} />

      <section style={{ background: "#fff", border: "2px solid var(--pitch)", borderRadius: 12, padding: 16, marginBottom: 20 }}>
        <h2 style={{ fontSize: 16, margin: "0 0 12px" }}>Profile</h2>
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 16 }}>
          {user.photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={user.photoUrl}
              alt={user.name}
              style={{ width: 72, height: 72, borderRadius: "50%", objectFit: "cover", border: "2px solid var(--pitch)" }}
            />
          ) : (
            <div
              style={{
                width: 72,
                height: 72,
                borderRadius: "50%",
                background: "var(--turf)",
                color: "#fff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 26,
                fontWeight: 800,
              }}
            >
              {user.name.charAt(0).toUpperCase()}
            </div>
          )}
          <div style={{ fontSize: 13, color: "#6B7280" }}>
            <div style={{ fontWeight: 800, color: "var(--pitch)", fontSize: 15 }}>{user.name}</div>
            <div>{user.email}</div>
            <div>{user.role.replace("_", " ")}</div>
          </div>
        </div>

        <form action={updateProfile} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <label style={{ fontSize: 12, fontWeight: 700 }}>Name</label>
            <input name="name" defaultValue={user.name} required style={{ padding: 8, border: "1px solid #d1d5db", borderRadius: 6, fontSize: 13, boxSizing: "border-box" }} />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <label style={{ fontSize: 12, fontWeight: 700 }}>Profile photo URL (optional)</label>
            <input name="photoUrl" defaultValue={user.photoUrl ?? ""} placeholder="https://example.com/avatar.jpg" style={{ padding: 8, border: "1px solid #d1d5db", borderRadius: 6, fontSize: 13, boxSizing: "border-box" }} />
          </div>
          <button type="submit" style={{ alignSelf: "flex-start", padding: "8px 16px", background: "var(--pitch)", color: "#fff", border: "none", borderRadius: 6, fontWeight: 700, cursor: "pointer" }}>
            Save profile
          </button>
        </form>
      </section>

      <section style={{ background: "#fff", border: "2px solid var(--pitch)", borderRadius: 12, padding: 16 }}>
        <h2 style={{ fontSize: 16, margin: "0 0 4px" }}>Change password</h2>
        <p style={{ fontSize: 12, color: "#6B7280", margin: "0 0 12px" }}>You'll stay signed in on this device; all other sessions are signed out.</p>
        <form action={changePassword} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <label style={{ fontSize: 12, fontWeight: 700 }}>Current password</label>
            <input name="currentPassword" type="password" required style={{ padding: 8, border: "1px solid #d1d5db", borderRadius: 6, fontSize: 13, boxSizing: "border-box" }} />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <label style={{ fontSize: 12, fontWeight: 700 }}>New password</label>
            <input name="newPassword" type="password" required minLength={8} style={{ padding: 8, border: "1px solid #d1d5db", borderRadius: 6, fontSize: 13, boxSizing: "border-box" }} />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <label style={{ fontSize: 12, fontWeight: 700 }}>Confirm new password</label>
            <input name="confirmPassword" type="password" required minLength={8} style={{ padding: 8, border: "1px solid #d1d5db", borderRadius: 6, fontSize: 13, boxSizing: "border-box" }} />
          </div>
          <button type="submit" style={{ alignSelf: "flex-start", padding: "8px 16px", background: "var(--pitch)", color: "#fff", border: "none", borderRadius: 6, fontWeight: 700, cursor: "pointer" }}>
            Change password
          </button>
        </form>
      </section>
    </main>
  );
}