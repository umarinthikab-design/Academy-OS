import { getAcademyTimeZone } from "@/lib/academyTime";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { getPermissions } from "@/lib/permissions";
import { approveRegistration, rejectRegistration } from "./actions";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusBanner } from "@/components/StatusBanner";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { ConfirmDeleteButton } from "@/components/ConfirmDeleteButton";
import { inputBase } from "@/components/ui/Form";

// Same local-getters date formatting as app/schedule/page.tsx's
// toDateInputValue - .toISOString().slice(0,10) reads back the UTC calendar
// date, which is one day early for any timezone behind UTC.
function toDateInputValue(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function formatDate(d: Date, tz: string) {
  return new Date(d).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",

    timeZone: tz,
  });
}

const fieldLabel: React.CSSProperties = {
  display: "block",
  fontSize: 13,
  fontWeight: 700,
  marginBottom: 4,
  color: "var(--text-heading)",
};

// Native <details> keeps each registration collapsed to one slim line with no
// client JS. The CSS hides the default marker and rotates the chevron.
const ROW_CSS = `
.reg-row > summary { list-style: none; cursor: pointer; }
.reg-row > summary::-webkit-details-marker { display: none; }
.reg-row > summary:focus-visible { outline: 2px solid var(--text-brand); outline-offset: 2px; border-radius: 10px; }
.reg-row .reg-chevron { transition: transform 0.15s ease; }
.reg-row[open] .reg-chevron { transform: rotate(180deg); }
`;

export default async function RegistrationsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string }>;
}) {
  const params = await searchParams;
  const academyTz = await getAcademyTimeZone();
  const perms = await getPermissions();
  if (!(perms.isAdmin || perms.isClubManager)) redirect("/?error=no_permission");

  const [registrations, batches, ageGroups, settings] = await Promise.all([

    prisma.pendingRegistration.findMany({
      where: { status: "PENDING" },
      orderBy: { createdAt: "asc" },
    }),
    prisma.batch.findMany({ include: { ageGroup: true }, orderBy: { name: "asc" } }),
    prisma.ageGroup.findMany({ orderBy: { sortOrder: "asc" } }),
    prisma.academySettings.findFirst(),
  ]);

  return (
    <>
      <style>{ROW_CSS}</style>
      <PageHeader
        title="Registrations"
        subtitle={
          registrations.length > 0
            ? registrations.length + " awaiting review"
            : "Player sign-ups submitted through the registration form."
        }
      />

      <StatusBanner error={params.error} success={params.success} />

      {registrations.length === 0 ? (
        <EmptyState icon="squad" title="No pending registrations" message="New sign-ups from the registration form will show up here." />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {registrations.map((r) => {
            const incomplete = !r.playerName || !r.dateOfBirth;
            return (
              <details
                key={r.id}
                className="reg-row"
                open={registrations.length === 1}

                style={{
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius-lg)",
                  boxShadow: "var(--shadow-sm)",
                }}
              >
                <summary style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 18px" }}>
                  <div style={{ flex: "1 1 auto", minWidth: 0 }}>
                    <div style={{ fontSize: 16, fontWeight: 700, color: "var(--text-heading)" }}>
                      {r.playerName || "Unmapped submission"}
                    </div>
                    <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 2 }}>
                      Submitted {formatDate(r.createdAt, academyTz)}
                    </div>
                  </div>
                  {incomplete && <Badge tone="warning">Incomplete</Badge>}
                  <svg
                    className="reg-chevron"
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                    style={{ color: "var(--text-muted)", flexShrink: 0 }}
                  >
                    <polyline points="6 9 12 15 18 9" />
                  </svg>

                </summary>

                <div style={{ padding: "16px 18px 18px", borderTop: "1px solid var(--border)" }}>
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
                        <label style={fieldLabel}>Age group</label>
                        {settings?.autoAssignPlayerAgeGroup ? <p style={{ fontSize: 13 }}>Assigned automatically from the club's DOB rules.</p> : (
                          <select name="ageGroupId" defaultValue="" style={inputBase}>
                            <option value="">Use selected batch's age group</option>
                            {ageGroups.map(group => <option key={group.id} value={group.id}>{group.name}</option>)}
                          </select>
                        )}
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
                      <summary style={{ cursor: "pointer", fontSize: 13, fontWeight: 700, color: "var(--text-brand)", padding: "9px 0", outline: "none" }}>
                        View full submission
                      </summary>
                      <pre style={{ margin: "0 0 12px", fontSize: 13, whiteSpace: "pre-wrap", wordBreak: "break-word", color: "var(--text-muted)" }}>
                        {JSON.stringify(r.rawPayload, null, 2)}
                      </pre>
                    </details>

                    <div>
                      <Button variant="approval" type="submit">Approve & add to squad</Button>
                    </div>
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
              </details>
            );
          })}
        </div>
      )}
    </>
  );

}
