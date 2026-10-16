import { Fragment } from "react";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/Button";
import { redirect } from "next/navigation";
import { getPermissions } from "@/lib/permissions";
import { getAcademySettings } from "@/lib/confirmations";
import { StatusBanner } from "@/components/StatusBanner";
import { updateAcademySettings } from "./actions";
import { PageHeader } from "@/components/ui/PageHeader";
import { SettingsSection } from "@/components/ui/SettingsSection";
import { Field, Input } from "@/components/ui/Form";
import { LogoUpload } from "@/components/ui/LogoUpload";
import { AgeRangeCalculator } from "@/components/ui/AgeRangeCalculator";

export default async function AcademySettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string }>;
}) {
  const params = await searchParams;
  const perms = await getPermissions();
  if (!perms.isAdmin && !perms.isClubManager) redirect("/?error=no_permission");

  const settings = await getAcademySettings();
  const ageGroups = await prisma.ageGroup.findMany({ orderBy: { sortOrder: "asc" } });

  return (
    <>
      <PageHeader
        title="Club Settings"
        subtitle="Academy-wide configuration - how sessions and confirmations work for the whole club."
      />

      <StatusBanner error={params.error} success={params.success} />

      <form
        action={updateAcademySettings}
        style={{ display: "flex", flexDirection: "column", gap: 20, maxWidth: 900 }}
      >
        <SettingsSection title="Identity &amp; Branding">
          <div className="form-grid-2col" style={{ gap: 20 }}>
            <Field
              label="Academy Name"
              hint="Displayed as the dominant wordmark across the app."
            >
              <Input name="academyName" maxLength={60} defaultValue={settings.academyName} required />
            </Field>
            <Field
              label="Club Logo (optional)"
              hint="Uploaded at up to 1024px with transparency kept for crisp display. Falls back to the academy name when empty."
            >
              <LogoUpload name="logoUrl" current={settings.logoUrl} />
            </Field>
          </div>
        </SettingsSection>

        <SettingsSection title="Player age-group assignment">
          <label style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 12 }}>
            <input type="checkbox" name="autoAssignPlayerAgeGroup" defaultChecked={settings.autoAssignPlayerAgeGroup} />
            Automatically assign new players from their date of birth
          </label>
          <p style={{ fontSize: 13, color: "var(--text-muted)" }}>When enabled, one inclusive birth-date range must match. Gaps require a rule update; overlapping ranges are rejected. When disabled, staff choose the age group. Existing players are not reassigned when these rules change.</p>
          {ageGroups.length === 0 && <p>Create age groups before configuring assignment.</p>}
          <details open={settings.autoAssignPlayerAgeGroup} style={{ marginTop: 8 }}>
            <summary style={{ cursor: "pointer", fontWeight: 600, fontSize: 14, padding: "6px 0" }}>
              Birth-date ranges ({ageGroups.length} age groups)
            </summary>
            <div style={{ marginTop: 8 }}>
              <AgeRangeCalculator groups={ageGroups.map(g => ({ id: g.id, name: g.name }))} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "minmax(56px, auto) 1fr 1fr", gap: "8px 10px", alignItems: "center", marginTop: 8 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase" as const, letterSpacing: 0.4 }}>Age group</div>
              <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase" as const, letterSpacing: 0.4 }}>Born from</div>
              <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase" as const, letterSpacing: 0.4 }}>Born through</div>
              {ageGroups.map(group => (
                <Fragment key={group.id}>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{group.name}</div>
                  <Input name={`dobFrom_${group.id}`} type="date" aria-label={`${group.name} born from (inclusive)`} defaultValue={group.birthDateFrom?.toISOString().slice(0, 10) ?? ""} />
                  <Input name={`dobTo_${group.id}`} type="date" aria-label={`${group.name} born through (inclusive)`} defaultValue={group.birthDateTo?.toISOString().slice(0, 10) ?? ""} />
                </Fragment>
              ))}
            </div>
          </details>
        </SettingsSection>

        <SettingsSection title="Session Workflow">
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              paddingBottom: 16,
              borderBottom: "1px solid var(--border)",
              marginBottom: 16,
            }}
          >
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text)" }}>Pre-session coach confirmation</div>
              <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 2 }}>
                Coaches RSVP "will I attend" before each session. Self-service - no approval needed.
              </div>
            </div>
            <input
              type="checkbox"
              name="preSessionConfirmationEnabled"
              defaultChecked={settings.preSessionConfirmationEnabled}
              style={{ width: 20, height: 20, flexShrink: 0, accentColor: "var(--secondary)" }}
            />
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              paddingBottom: 16,
              borderBottom: "1px solid var(--border)",
              marginBottom: 16,
            }}
          >
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text)" }}>Advance player attendance (RSVP)</div>
              <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 2 }}>
                When on, coaches can mark each player Attending or Not attending before a session. Attendance is still recorded after the session as usual. Off by default.
              </div>
            </div>
            <input
              type="checkbox"
              name="playerAdvanceRsvpEnabled"
              defaultChecked={settings.playerAdvanceRsvpEnabled}
              style={{ width: 20, height: 20, flexShrink: 0, accentColor: "var(--secondary)" }}
            />
          </div>

          {perms.isAdmin && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                paddingBottom: 16,
                borderBottom: "1px solid var(--border)",
                marginBottom: 16,
              }}
            >
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text)" }}>Club managers can author drills</div>
                <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 2 }}>
                  When on, club managers can add drills to the library like coaches. They can always edit, archive, and delete drills.
                </div>
              </div>
              <input
                type="checkbox"
                name="clubManagersCanAuthorDrills"
                defaultChecked={settings.clubManagersCanAuthorDrills}
                style={{ width: 20, height: 20, flexShrink: 0, accentColor: "var(--secondary)" }}
              />
            </div>
          )}

          <div className="form-grid-2col" style={{ gap: 20 }}>
            <Field
              label="Confirmation window (hours before session)"
              hint="How far ahead a session appears in each coach's 'Confirm your upcoming sessions' list."
            >
              <Input
                name="confirmationWindowHours"
                type="number"
                min={1}
                max={720}
                defaultValue={settings.confirmationWindowHours}
                required
              />
            </Field>
            <Field
              label="Priority window (hours before session)"
              hint="Within this window, an unanswered confirmation escalates to the priority treatment. Must be shorter than the confirmation window."
            >
              <Input
                name="priorityWindowHours"
                type="number"
                min={1}
                max={720}
                defaultValue={settings.priorityWindowHours}
                required
              />
            </Field>
            <Field
              label="Coach response deadline (hours before session)"
              hint="Coaches should confirm or decline at least this many hours before a session. Late answers are still accepted but marked late; unanswered coaches are flagged to admins and head coaches. Must be shorter than the confirmation window."
            >
              <Input
                name="coachConfirmationDeadlineHours"
                type="number"
                min={1}
                max={720}
                defaultValue={settings.coachConfirmationDeadlineHours}

                required
              />
            </Field>
            <Field
              label="Academy timezone"
              hint="IANA timezone string (e.g. America/New_York, Europe/London, UTC). Affects how wall-clock session times, deadlines, and today filters are interpreted."
            >
              <Input
                name="timeZone"
                defaultValue={settings.timeZone ?? "UTC"}
                required
              />
            </Field>
          </div>
        </SettingsSection>

        <div style={{ fontSize: 13, color: "var(--text-faint)" }}>
          A coach declining or failing to confirm appears in the "Needs attention" section on admin and head-coach
          dashboards so the session can be re-staffed in time.
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <Button>Save club settings</Button>
        </div>
      </form>
    </>
  );
}

export const dynamic = "force-dynamic";
