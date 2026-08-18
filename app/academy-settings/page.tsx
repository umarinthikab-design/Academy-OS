import { redirect } from "next/navigation";
import { getPermissions } from "@/lib/permissions";
import { getAcademySettings } from "@/lib/confirmations";
import { StatusBanner } from "@/components/StatusBanner";
import { updateAcademySettings } from "./actions";
import { PageHeader } from "@/components/ui/PageHeader";
import { Field, Input } from "@/components/ui/Form";

const ERROR_MESSAGES: Record<string, string> = {
  no_permission: "You don't have permission to do that.",
  priority_window: "The priority window must be shorter than the confirmation window.",
};

export default async function AcademySettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string }>;
}) {
  const params = await searchParams;
  const perms = await getPermissions();
  if (!perms.isAdmin && !perms.isClubManager) redirect("/?error=no_permission");

  const settings = await getAcademySettings();

  return (
    <>
      <PageHeader
        title="Club Settings"
        subtitle="Academy-wide configuration - how sessions and confirmations work for the whole club."
      />

      <StatusBanner
        error={params.error ? ERROR_MESSAGES[params.error] ?? params.error : undefined}
        success={params.success}
      />

      <form
        action={updateAcademySettings}
        style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius)", boxShadow: "var(--shadow-sm)", padding: 18 }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            paddingBottom: 12,
            borderBottom: "1px solid var(--border)",
            marginBottom: 16,
          }}
        >
          <div>
            <div style={{ fontSize: 15, fontWeight: 800 }}>Pre-session coach confirmation</div>
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
              Coaches RSVP "will I attend" before each session. Self-service - no approval needed.
            </div>
          </div>
          <input
            type="checkbox"
            name="preSessionConfirmationEnabled"
            defaultChecked={settings.preSessionConfirmationEnabled}
            style={{ width: 20, height: 20, flexShrink: 0 }}
          />
        </div>

        <div className="form-grid-2col" style={{ gap: 16 }}>
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
        </div>

        <div style={{ marginTop: 16, fontSize: 12, color: "var(--text-faint)" }}>
          A coach declining or failing to confirm appears in the "Needs attention" section on admin and head-coach
          dashboards so the session can be re-staffed in time.
        </div>

        <div style={{ marginTop: 18, display: "flex", gap: 10, alignItems: "center" }}>
          <button
            type="submit"
            style={{ padding: "9px 20px", background: "var(--primary)", color: "#fff", border: "none", borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: "pointer" }}
          >
            Save club settings
          </button>
        </div>
      </form>
    </>
  );
}

export const dynamic = "force-dynamic";
