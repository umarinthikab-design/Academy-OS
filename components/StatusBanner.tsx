import { isKnownSuccess } from "@/lib/successMessages";
// Banner for action results (error/success) shown after redirects.

const ERROR_MESSAGES: Record<string, string> = {
  batch_age_group: "The selected batch belongs to a different age group. Choose a matching batch or leave it unassigned.",
  invalid_filters: "Choose valid dates, with the from date on or before the through date.",
  invalid_email: "Enter a valid email address.",
  invalid_dob: "Enter a valid date of birth that is not in the future.",
  age_group_required: "Choose an age group for the player.",
  age_group_no_match: "No age group matches this date of birth. Ask an admin or club manager to review the eligibility rules.",
  age_group_overlap: "Age-group birth-date ranges overlap. Use non-overlapping ranges before enabling automatic assignment.",
  age_group_rule: "Each eligibility rule needs a valid start and end date, with the start on or before the end.",
  invalid_roster: "One or more players are outside this session's roster. Refresh and try again.",
  photo_invalid: "The photo could not be saved. Upload a valid image and try again.",
  timezone: "Enter a valid IANA timezone, such as Asia/Colombo.",
  duplicate_email: "That email is already in use by another account.",
  duplicate_name: "That name is already in use.",
  no_permission: "You don't have permission to do that.",
  in_use: "Can't delete this - it's still being used elsewhere. Remove those references first.",
  admin_account: "This is an admin login, so it can't be deleted, archived or reset from the Coaches page.",
  missing_fields: "Please fill in all required fields.",
  already_resolved: "This session's attendance is already finalized.",
  not_started: "This session hasn't started yet - you can't check in early.",
  attendance_not_open: "Attendance can be marked once the session has started.",
  already_shared: "This session plan is already shared or has a share request in flight.",
  attach_window_closed: "The 72-hour window to attach or edit a session plan has closed.",
  account_archived: "This account has been deactivated - contact your administrator.",
  invalid_status: "That player status isn't valid.",
  drill_in_use: "This drill is used in a session plan, so it can't be deleted. Archive it instead.",
  category_in_use: "This category is still assigned to a drill, so it can't be deleted.",
  skill_in_use: "This skill still has ratings recorded for a player, so it can't be deleted.",
  rsvp_disabled: "Advance attendance is switched off in Club Settings.", rsvp_closed: "This session has started or been closed, so advance attendance can no longer be changed.", deadline_window: "The response deadline must be shorter than the confirmation window.", priority_window: "The priority window must be shorter than the confirmation window.",
  password_too_short: "New password must be at least 8 characters.",
  password_mismatch: "New password and confirmation don't match.",
  wrong_password: "Current password is incorrect.",
  invalid_position: "That position isn't valid for this player.",
  not_assistant: "Only assistant coaches can be promoted to head coach.",
  no_sessions: "There are no scheduled sessions on that date.",
  schedule_conflict: "A selected coach already has a session that overlaps this time on that date.",
  session_has_records: "This session already has attendance recorded or has been finalized, so it can't be deleted.",
};

export function StatusBanner({ error, success }: { error?: string; success?: string }) {
  if (error) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          background: "var(--error-bg)",
          color: "var(--error)",
          border: "1px solid var(--error)",
          padding: "10px 14px",
          borderRadius: 8,
          marginBottom: 16,
          fontSize: 13,
          fontWeight: 600,
        }}
      >
        <span aria-hidden="true">⚠</span>
        {ERROR_MESSAGES[error] || "Something went wrong. Please try again."}
      </div>
    );
  }
  if (success) {
    const safeSuccess = isKnownSuccess(success) ? success : "Done.";
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          background: "var(--success-bg)",
          color: "var(--success)",
          border: "1px solid var(--success)",
          padding: "10px 14px",
          borderRadius: 8,
          marginBottom: 16,
          fontSize: 13,
          fontWeight: 600,
        }}
      >
        <span aria-hidden="true">✓</span>
        {safeSuccess}
      </div>
    );
  }
  return null;
}