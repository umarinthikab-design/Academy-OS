"use client";

// AvailabilitySelect - the fast availability flag setter on the squad list
// and player page. Auto-submits on change. Lives in a client component so
// the onChange handler stays on the client (server components can't hold
// event handlers, and this setter is passed around as an EntityHero action).
// The bound server action is passed in from the parent server component.

export function AvailabilitySelect({
  action,
  availability,
}: {
  action: (formData: FormData) => Promise<void>;
  availability: "AVAILABLE" | "INJURED" | "INACTIVE";
}) {
  return (
    <form
      action={action}
      style={{ display: "flex", alignItems: "center", gap: 6 }}
      title="Set availability"
    >
      <select
        name="availability"
        defaultValue={availability}
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
        <option value="AVAILABLE">Available</option>
        <option value="INJURED">Injured</option>
        <option value="INACTIVE">Inactive</option>
      </select>
    </form>
  );
}
