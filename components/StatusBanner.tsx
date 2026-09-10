// Banner for action results (error/success) shown after redirects.

const ERROR_MESSAGES: Record<string, string> = {
  duplicate_email: "That email is already in use by another account.",
  duplicate_name: "That name is already in use.",
  no_permission: "You don't have permission to do that.",
  in_use: "Can't delete this - it's still being used elsewhere. Remove those references first.",
  missing_fields: "Please fill in all required fields.",
  already_resolved: "This session's attendance is already finalized.",
  not_started: "This session hasn't started yet - you can't check in early.",
  already_shared: "This session plan is already shared or has a share request in flight.",
  attach_window_closed: "The 72-hour window to attach or edit a session plan has closed.",
  account_archived: "This account has been deactivated - contact your administrator.",
  invalid_status: "That player status isn't valid.",
  drill_in_use: "This drill is used in a session plan, so it can't be deleted. Archive it instead.",
  category_in_use: "This category is still assigned to a drill, so it can't be deleted.",
  skill_in_use: "This skill still has ratings recorded for a player, so it can't be deleted.",
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
        {success}
      </div>
    );
  }
  return null;
}