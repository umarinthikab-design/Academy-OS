import { prisma } from "@/lib/prisma";
import { createLocation, deleteLocation } from "./actions";
import { getPermissions } from "@/lib/permissions";

export default async function LocationsPage() {
  const perms = await getPermissions();
  const canEdit = perms.isAdmin || perms.canEditLocations;
  const locations = await prisma.location.findMany({ orderBy: { name: "asc" } });

  return (
    <main style={{ maxWidth: 720, margin: "0 auto", padding: "40px 20px" }}>
      <h1 style={{ fontSize: 28, margin: "8px 0 20px" }}>Locations</h1>

      {!canEdit && (
        <p style={{ fontSize: 13, color: "#6B7280", marginTop: -8, marginBottom: 20 }}>
          View only — you don't have edit access to locations.
        </p>
      )}

      {canEdit && (
        <form
          action={createLocation}
          style={{
            background: "#fff",
            border: "2px solid var(--pitch)",
            borderRadius: 12,
            padding: 16,
            marginBottom: 24,
            display: "flex",
            gap: 10,
          }}
        >
          <input
            name="name"
            placeholder="e.g. CR7, Colombo 03"
            required
            style={{ flex: 1, padding: 8, border: "1px solid #d1d5db", borderRadius: 6 }}
          />
          <button
            type="submit"
            style={{
              padding: "8px 16px",
              background: "var(--pitch)",
              color: "#fff",
              border: "none",
              borderRadius: 6,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Add Location
          </button>
        </form>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {locations.map((l) => (
          <div
            key={l.id}
            style={{
              background: "#fff",
              border: "2px solid var(--pitch)",
              borderRadius: 10,
              padding: "10px 14px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <span>{l.name}</span>
            {canEdit && (
              <form action={deleteLocation.bind(null, l.id)}>
                <button
                  type="submit"
                  style={{ background: "none", border: "none", color: "#E63946", cursor: "pointer", fontWeight: 700 }}
                >
                  Remove
                </button>
              </form>
            )}
          </div>
        ))}
        {locations.length === 0 && <p style={{ color: "#6B7280" }}>No locations yet — add your first one above.</p>}
      </div>
    </main>
  );
}
