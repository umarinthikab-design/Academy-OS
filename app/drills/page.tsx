import { prisma } from "@/lib/prisma";
import { createDrill, addFeedback, approveDrill, rejectDrill } from "./actions";
import { getPermissions } from "@/lib/permissions";
import { ConfirmDeleteButton } from "@/components/ConfirmDeleteButton";
import { StatusBanner } from "@/components/StatusBanner";

const CATEGORIES = ["Warm-up", "Passing", "Dribbling", "Shooting", "Defending", "Fun Game"];

export default async function DrillsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string }>;
}) {
  const params = await searchParams;
  const perms = await getPermissions();
  const canSuggest = perms.canSuggestDrills;
  const canApprove = perms.isAdmin || perms.canApproveRequests;

  const [drills, ageGroups] = await Promise.all([
    prisma.drill.findMany({
      include: { createdBy: { include: { user: true } }, ageGroups: true, feedback: { include: { author: { include: { user: true } } }, orderBy: { createdAt: "asc" } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.ageGroup.findMany({ orderBy: { sortOrder: "asc" } }),
  ]);

  const approved = drills.filter((d) => d.status === "APPROVED");
  const pending = drills.filter((d) => d.status === "PENDING");

  return (
    <main style={{ maxWidth: 780, margin: "0 auto", padding: "40px 20px" }}>
      <h1 style={{ fontSize: 28, margin: "8px 0 20px" }}>Drill Library</h1>

      <StatusBanner error={params.error} success={params.success} />

      {!canSuggest && (
        <p style={{ fontSize: 13, color: "#6B7280", marginTop: -8, marginBottom: 20 }}>
          Only coaches can suggest drills. You can still view the library and pending queue below.
        </p>
      )}

      {canSuggest && (
        <form
          action={createDrill}
          style={{ background: "#fff", border: "2px solid var(--pitch)", borderRadius: 12, padding: 16, marginBottom: 28 }}
        >
          <div className="form-grid-2col" style={{ marginBottom: 12 }}>
            <div>
              <label style={{ display: "block", fontSize: 11, fontWeight: 700, marginBottom: 4 }}>Name</label>
              <input name="name" required style={{ width: "100%", padding: 8, border: "1px solid #d1d5db", borderRadius: 6, boxSizing: "border-box" }} />
            </div>
            <div>
              <label style={{ display: "block", fontSize: 11, fontWeight: 700, marginBottom: 4 }}>Category</label>
              <select name="category" required style={{ width: "100%", padding: 8, border: "1px solid #d1d5db", borderRadius: 6, boxSizing: "border-box" }}>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ display: "block", fontSize: 11, fontWeight: 700, marginBottom: 4 }}>Duration (minutes)</label>
              <input name="duration" type="number" defaultValue={10} required style={{ width: "100%", padding: 8, border: "1px solid #d1d5db", borderRadius: 6, boxSizing: "border-box" }} />
            </div>
            <div>
              <label style={{ display: "block", fontSize: 11, fontWeight: 700, marginBottom: 4 }}>Player range</label>
              <input name="playerRange" placeholder="e.g. 4-12" style={{ width: "100%", padding: 8, border: "1px solid #d1d5db", borderRadius: 6, boxSizing: "border-box" }} />
            </div>
            <div style={{ gridColumn: "1 / -1" }}>
              <label style={{ display: "block", fontSize: 11, fontWeight: 700, marginBottom: 4 }}>Description</label>
              <textarea name="description" style={{ width: "100%", padding: 8, border: "1px solid #d1d5db", borderRadius: 6, boxSizing: "border-box", minHeight: 60 }} />
            </div>
            <div style={{ gridColumn: "1 / -1" }}>
              <label style={{ display: "block", fontSize: 11, fontWeight: 700, marginBottom: 4 }}>Age groups</label>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                {ageGroups.map((ag) => (
                  <label key={ag.id} style={{ fontSize: 13 }}>
                    <input type="checkbox" name="ageGroups" value={ag.id} /> {ag.name}
                  </label>
                ))}
              </div>
            </div>
          </div>
          <button type="submit" style={{ padding: "8px 16px", background: "var(--pitch)", color: "#fff", border: "none", borderRadius: 6, fontWeight: 700, cursor: "pointer" }}>
            Suggest Drill
          </button>
          <p style={{ fontSize: 11, color: "#9CA3AF", marginTop: 8 }}>
            All new drills go to Pending Approval below — nothing joins the library automatically.
          </p>
        </form>
      )}

      <h3 style={{ fontSize: 16 }}>Pending Approval ({pending.length})</h3>
      <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 28 }}>
        {pending.map((d) => (
          <div key={d.id} style={{ background: "#FFF3CD", border: "2px solid var(--amber)", borderRadius: 12, padding: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 8 }}>
              <div>
                <strong>{d.name}</strong>
                <span style={{ fontSize: 11, color: "#6B7280", marginLeft: 8 }}>
                  {d.category} · {d.duration}m · submitted by {d.createdBy.user.name}
                </span>
                {d.description && <p style={{ fontSize: 13, margin: "6px 0 0" }}>{d.description}</p>}
              </div>
              {canApprove && (
                <div style={{ display: "flex", gap: 6 }}>
                  <form action={approveDrill.bind(null, d.id)}>
                    <button type="submit" style={{ padding: "5px 10px", background: "var(--turf)", color: "#fff", border: "none", borderRadius: 6, fontWeight: 700, fontSize: 12, cursor: "pointer" }}>
                      Approve
                    </button>
                  </form>
                  <ConfirmDeleteButton
                    action={rejectDrill.bind(null, d.id)}
                    confirmMessage={`Reject "${d.name}"? This deletes the suggestion and its feedback thread permanently.`}
                    label="Reject"
                    buttonStyle={{ padding: "5px 10px", background: "#fff", color: "#E63946", border: "2px solid #E63946", borderRadius: 6, fontWeight: 700, fontSize: 12, cursor: "pointer" }}
                  />
                </div>
              )}
            </div>

            {d.feedback.length > 0 && (
              <div style={{ marginTop: 10, background: "#fff", borderRadius: 8, padding: 10 }}>
                {d.feedback.map((f) => (
                  <div key={f.id} style={{ fontSize: 12, marginBottom: 4 }}>
                    <strong>{f.author.user.name}:</strong> {f.message}
                  </div>
                ))}
              </div>
            )}

            {canSuggest && (
              <form action={addFeedback.bind(null, d.id)} style={{ display: "flex", gap: 6, marginTop: 10 }}>
                <input name="message" placeholder="Add feedback..." required style={{ flex: 1, padding: 6, border: "1px solid #d1d5db", borderRadius: 6, fontSize: 12 }} />
                <button type="submit" style={{ padding: "6px 12px", background: "var(--pitch)", color: "#fff", border: "none", borderRadius: 6, fontWeight: 700, fontSize: 12, cursor: "pointer" }}>
                  Send
                </button>
              </form>
            )}
          </div>
        ))}
        {pending.length === 0 && <p style={{ color: "#6B7280", fontSize: 13 }}>Nothing waiting on review.</p>}
      </div>

      <h3 style={{ fontSize: 16 }}>Library ({approved.length})</h3>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {approved.map((d) => (
          <div key={d.id} style={{ background: "#fff", border: "2px solid var(--pitch)", borderRadius: 10, padding: "10px 14px" }}>
            <strong>{d.name}</strong>
            <span style={{ fontSize: 11, color: "#6B7280", marginLeft: 8 }}>
              {d.category} · {d.duration}m · {d.ageGroups.map((a) => a.name).join(", ")}
            </span>
          </div>
        ))}
        {approved.length === 0 && <p style={{ color: "#6B7280", fontSize: 13 }}>No approved drills yet.</p>}
      </div>
    </main>
  );
}
