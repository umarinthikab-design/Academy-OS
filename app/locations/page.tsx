import { prisma } from "@/lib/prisma";
import { createLocation, deleteLocation } from "./actions";
import { getPermissions } from "@/lib/permissions";
import { ConfirmDeleteButton } from "@/components/ConfirmDeleteButton";
import { StatusBanner } from "@/components/StatusBanner";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
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
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {locations.map((l) => (
            <div
              key={l.id}
              style={{
                background: "var(--surface)",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius)",
                padding: "12px 16px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ width: 32, height: 32, borderRadius: 8, background: "var(--surface-muted)", color: "var(--secondary)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Icon name="pin" size={16} />
                </span>
                <span style={{ fontWeight: 700, fontSize: 14 }}>{l.name}</span>
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