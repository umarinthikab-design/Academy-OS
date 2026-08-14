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
};

export function StatusBanner({ error, success }: { error?: string; success?: string }) {
  if (error) {
    return (
      <div style={{ background: "#FEE2E2", color: "#991B1B", padding: "10px 14px", borderRadius: 8, marginBottom: 16, fontSize: 13, fontWeight: 600 }}>
        {ERROR_MESSAGES[error] || "Something went wrong. Please try again."}
      </div>
    );
  }
  if (success) {
    return (
      <div style={{ background: "#D1FAE5", color: "#065F46", padding: "10px 14px", borderRadius: 8, marginBottom: 16, fontSize: 13, fontWeight: 600 }}>
        {success}
      </div>
    );
  }
  return null;
}
