import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { getPermissions } from "@/lib/permissions";
import { approveRegistration, rejectRegistration } from "./actions";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusBanner } from "@/components/StatusBanner";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { ConfirmDeleteButton } from "@/components/ConfirmDeleteButton";
import { inputBase } from "@/components/ui/Form";

// Same local-getters date formatting as app/schedule/page.tsx's
// toDateInputValue - .toISOString().slice(0,10) reads back the UTC calendar
// date, which is one day early for any timezone behind UTC.
function toDateInputValue(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

const fieldLabel: React.CSSProperties = { display: "block", fontSize: 12, fontWeight: 700, marginBottom: 4 };

export default async function RegistrationsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string }>;
}) {
  const params = await searchParams;
  const perms = await getPermissions();
  if (!(perms.isAdmin || perms.isClubManager)) redirect("/?error=no_permission");

  const [registrations, batches] = await Promise.all([
    prisma.pendingRegistration.findMany({
      where: { status: "PENDING" },
      orderBy: { createdAt: "asc" },
    }),
    prisma.batch.findMany({ include: { ageGroup: true }, orderBy: { name: "asc" } }),
  ]);

  return (
    <>
      <PageHeader title="Registrations" subtitle="Player sign-ups submitted through the registration form, awaiting review." />

      <StatusBanner error={params.error} success={params.success} />

      {registrations.length === 0 ? (
        <EmptyState icon="squad" title="No pending registrations" message="New sign-ups from the registration form will show up here." />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {registrations.map((r) => {
            const incomplete = !r.playerName || !r.dateOfBirth;
            return (
              <div key={r.id} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", boxShadow: "var(--shadow-sm)", padding: 20 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
                  <div>
                    <div style={{ fontFamily: "var(--font-headline)", fontSize: 18, fontWeight: 600, color: "var(--primary)" }}>
                      {r.playerName || "Unmapped submission"}
                    </div>
                    <div style={{ fontSize: 12.5, color: "var(--text-faint)", marginTop: 2 }}>
                      Submitted {r.createdAt.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                    </div>
                  </div>
                  {incomplete && <Badge tone="warning">Incomplete mapping - check raw data</Badge>}
                </div>

                <form action={approveRegistration.bind(null, r.id)} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  <div className="form-grid-2col" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
                    <div>
                      <label style={fieldLabel}>Player name</label>
                      <input name="playerName" defaultValue={r.playerName ?? ""} required style={inputBase} />
                    </div>
                    <div>
                      <label style={fieldLabel}>Date of birth</label>
                      <input name="dateOfBirth" type="date" defaultValue={r.dateOfBirth ? toDateInputValue(r.dateOfBirth) : ""} required style={inputBase} />
                    </div>
                    <div>
                      <label style={fieldLabel}>Emergency contact name</label>
                      <input name="emergencyContactName" defaultValue={r.emergencyContactName ?? ""} style={inputBase} />
                    </div>
                    <div>
                      <label style={fieldLabel}>Emergency contact phone</label>
                      <input name="emergencyContactPhone" defaultValue={r.emergencyContactPhone ?? ""} style={inputBase} />
                    </div>
                    <div>
                      <label style={fieldLabel}>Assign to batch (optional)</label>
                      <select name="batchId" defaultValue="" style={inputBase}>
                        <option value="">No batch yet</option>
                        {batches.map((b) => (
                          <option key={b.id} value={b.id}>{b.name} ({b.ageGroup.name})</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <details style={{ background: "var(--surface-muted)", borderRadius: 8, padding: "0 12px" }}>
                    <summary style={{ cursor: "pointer", fontSize: 12.5, fontWeight: 700, color: "var(--secondary)", padding: "9px 0", outline: "none" }}>
                      View full submission
                    </summary>
                    <pre style={{ margin: "0 0 12px", fontSize: 11.5, whiteSpace: "pre-wrap", wordBreak: "break-word", color: "var(--text-muted)" }}>
                      {JSON.stringify(r.rawPayload, null, 2)}
                    </pre>
                  </details>

                  <button type="submit" style={{ alignSelf: "flex-start", padding: "9px 18px", background: "var(--secondary)", color: "#fff", border: "none", borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: "pointer", boxShadow: "var(--shadow-sm)" }}>
                    Approve & add to squad
                  </button>
                </form>

                {/* Sibling to the approve form, not nested inside it - forms
                    can't nest in HTML, and ConfirmDeleteButton renders its
                    own <form>. */}
                <div style={{ marginTop: 10 }}>
                  <ConfirmDeleteButton
                    action={rejectRegistration.bind(null, r.id)}
                    confirmMessage="Reject this registration? The record is kept, but no player will be created."
                    label="Reject"
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
