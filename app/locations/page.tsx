import { prisma } from "@/lib/prisma";
import { createLocation, deleteLocation } from "./actions";
import { getPermissions } from "@/lib/permissions";
import { ConfirmDeleteButton } from "@/components/ConfirmDeleteButton";
import { StatusBanner } from "@/components/StatusBanner";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { Badge } from "@/components/ui/Badge";
import { inputBase } from "@/components/ui/Form";
import { Icon } from "@/components/ui/Icon";

export default async function LocationsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string }>;
}) {
  const params = await searchParams;
  const perms = await getPermissions();
  const canEdit = perms.isAdmin || perms.canEditLocations;
  const locations = await prisma.location.findMany({ orderBy: { name: "asc" } });

  return (
    <>
      <PageHeader
        title="Locations"
        subtitle={canEdit ? "Where your sessions and matches take place." : "View only — you don't have edit access to locations."}
      />

      <StatusBanner error={params.error} success={params.success} />

      {canEdit && (
        <form
          action={createLocation}
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius)",
            boxShadow: "var(--shadow-sm)",
            padding: 18,
            marginBottom: 20,
            display: "flex",
            gap: 10,
            alignItems: "flex-end",
          }}
        >
          <div style={{ flex: 1 }}>
            <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 4 }}>Name</label>
            <input name="name" placeholder="e.g. CR7, Colombo 03" required style={inputBase} />
          </div>
          <button type="submit" style={{ padding: "9px 18px", background: "var(--primary)", color: "#fff", border: "none", borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: "pointer", whiteSpace: "nowrap" }}>
            Add Location
          </button>
        </form>
      )}

      {locations.length === 0 ? (
        <EmptyState
          icon="pin"
          title="No locations yet"
          message="Add your first training ground above to get started."
        />
      ) : (
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", overflow: "hidden", boxShadow: "var(--shadow-sm)" }}>
          <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--border)", background: "var(--surface-muted)", display: "flex", alignItems: "center", gap: 8 }}>
            <Icon name="pin" size={16} style={{ color: "var(--secondary)" }} />
            <span style={{ fontFamily: "var(--font-headline)", fontSize: 20, fontWeight: 600, color: "var(--primary)" }}>Locations</span>
            <Badge tone="muted" style={{ marginLeft: "auto" }}>{locations.length}</Badge>
          </div>
          {locations.map((l, idx) => (
            <div
              key={l.id}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "12px 16px",
                ...(idx > 0 ? { borderTop: "1px solid var(--border)" } : {}),
                background: idx % 2 === 1 ? "var(--surface-muted)" : "var(--surface)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ width: 32, height: 32, borderRadius: 8, background: "var(--surface-container)", color: "var(--secondary)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Icon name="pin" size={16} />
                </span>
                <span style={{ fontFamily: "var(--font-headline)", fontSize: 16, fontWeight: 600, color: "var(--primary)" }}>{l.name}</span>
              </div>
              {canEdit && (
                <ConfirmDeleteButton
                  action={deleteLocation.bind(null, l.id)}
                  confirmMessage={`Remove ${l.name}? This can't be undone.`}
                />
              )}
            </div>
          ))}
        </div>
      )}
    </>
  );
}