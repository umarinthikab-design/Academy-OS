"use client";

// PlayerStatusSelect - the fast status setter on the squad list and player
// page. Auto-submits on change. Lives in a client component so the onChange
// handler stays on the client (server components can't hold event handlers,
// and this setter is passed around as an EntityHero action). The bound server
// action is passed in from the parent server component.

export function PlayerStatusSelect({
  action,
  status,
}: {
  action: (formData: FormData) => Promise<void>;
  status: "ACTIVE" | "INJURED" | "SUSPENDED" | "INACTIVE";
}) {
  return (
    <form
      action={action}
      style={{ display: "flex", alignItems: "center", gap: 6 }}
      title="Set player status"
    >
      <select
        name="status"
        defaultValue={status}
        onChange={(e) => e.target.form?.requestSubmit()}
        style={{
          padding: "6px 8px",
          border: "1px solid var(--border)",
          borderRadius: 6,
          background: "var(--surface)",
          fontSize: 12,
          color: "var(--text)",
          cursor: "pointer",
        }}
      >
        <option value="ACTIVE">Active</option>
        <option value="INJURED">Injured</option>
        <option value="SUSPENDED">Suspended</option>
        <option value="INACTIVE">Inactive</option>
      </select>
    </form>
  );
}
