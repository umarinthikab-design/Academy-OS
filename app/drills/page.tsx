import { prisma } from "@/lib/prisma";
import { createDrill, updateDrill, addFeedback, approveDrill, rejectDrill, archiveDrill, reactivateDrill, deleteDrill } from "./actions";
import { getPermissions } from "@/lib/permissions";
import { ConfirmDeleteButton } from "@/components/ConfirmDeleteButton";
import { StatusBanner } from "@/components/StatusBanner";
import { PageHeader } from "@/components/ui/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { CollapsibleCreate } from "@/components/ui/CollapsibleCreate";
import { DrillPhotoUpload } from "@/components/ui/DrillPhotoUpload";
import { inputBase } from "@/components/ui/Form";
import { Icon } from "@/components/ui/Icon";

const ERROR_MESSAGES: Record<string, string> = {
  no_permission: "You don't have permission to do that.",
  missing_fields: "Please fill in all required fields.",
  in_use: "This drill is used in a session plan, so it can't be deleted. Archive it instead.",
};

const CATEGORIES = ["Warm-up", "Passing", "Dribbling", "Shooting", "Defending", "Fun Game"];

export default async function DrillsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string }>;
}) {
  const params = await searchParams;
  const perms = await getPermissions();
  const canCreate = perms.canAuthorDrills;
  const canSuggest = perms.canSuggestDrills;
  const canApprove = perms.isAdmin || perms.canApproveRequests;
  const canPublishEdit = perms.canEditDrills;
  const canManage = perms.isAdmin || perms.isClubManager;

  const [drills, archivedDrills, ageGroups] = await Promise.all([
    prisma.drill.findMany({
      where: { archivedAt: null },
      include: { createdBy: { include: { user: true } }, ageGroups: true, photos: { orderBy: { sortOrder: "asc" } }, feedback: { include: { author: { include: { user: true } } }, orderBy: { createdAt: "asc" } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.drill.findMany({
      where: { archivedAt: { not: null } },
      include: { createdBy: { include: { user: true } }, ageGroups: true },
      orderBy: { archivedAt: "desc" },
    }),
    prisma.ageGroup.findMany({ orderBy: { sortOrder: "asc" } }),
  ]);

  const approved = drills.filter((d) => d.status === "APPROVED");
  const pending = drills.filter((d) => d.status === "PENDING");

  const fieldLabel: React.CSSProperties = { display: "block", fontSize: 12, fontWeight: 700, marginBottom: 4, color: "var(--text)" };

  const PhotoStrip = ({ urls }: { urls: string[] }) =>
    urls.length > 0 ? (
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
        {urls.map((url, i) => (
          <img
            key={`${url.slice(0, 24)}-${i}`}
            src={url}
            alt=""
            style={{ width: 48, height: 48, objectFit: "cover", borderRadius: 6, border: "1px solid var(--border)" }}
          />
        ))}
      </div>
    ) : null;

  return (
    <>
      <PageHeader
        title="Drill Library"
        subtitle={canPublishEdit ? "Add drills, edit existing ones, and manage the library." : canSuggest ? "Suggest drills for the team library." : "Only coaches can suggest drills. You can still view the library and pending queue below."}
      />

      <StatusBanner error={params.error ? ERROR_MESSAGES[params.error] ?? params.error : undefined} success={params.success} />

      {canCreate && (
        <CollapsibleCreate title={canPublishEdit ? "Add a drill" : "Suggest a drill"}>
          <form action={createDrill}>
            <div className="form-grid-2col" style={{ gap: 12 }}>
              <div>
                <label style={fieldLabel}>Name</label>
                <input name="name" required style={inputBase} />
              </div>
              <div>
                <label style={fieldLabel}>Category</label>
                <select name="category" required style={inputBase}>
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={fieldLabel}>Duration (minutes)</label>
                <input name="duration" type="number" defaultValue={10} required style={inputBase} />
              </div>
              <div>
                <label style={fieldLabel}>Player range</label>
                <input name="playerRange" placeholder="e.g. 4-12" style={inputBase} />
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={fieldLabel}>Description</label>
                <textarea name="description" style={{ ...inputBase, minHeight: 70, resize: "vertical" }} />
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={fieldLabel}>Photos (optional)</label>
                <DrillPhotoUpload label="Add photos" />
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={fieldLabel}>Age groups</label>
                <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 4 }}>
                  {ageGroups.map((ag) => (
                    <label key={ag.id} style={{ fontSize: 13, display: "inline-flex", alignItems: "center", gap: 5 }}>
                      <input type="checkbox" name="ageGroups" value={ag.id} /> {ag.name}
                    </label>
                  ))}
                </div>
              </div>
            </div>
            <button type="submit" style={{ marginTop: 14, padding: "9px 18px", background: "var(--primary)", color: "#fff", border: "none", borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
              {canPublishEdit ? "Publish Drill" : "Suggest Drill"}
            </button>
            <p style={{ fontSize: 11, color: "var(--text-faint)", marginTop: 8 }}>
              {canPublishEdit
                ? "Published drills join the library immediately."
                : "All new drills go to Pending Approval below — nothing joins the library automatically."}
            </p>
          </form>
        </CollapsibleCreate>
      )}

      <h3 style={{ fontSize: 16, margin: "0 0 12px" }}>
        Pending Approval <span style={{ color: "var(--text-faint)", fontWeight: 600 }}>({pending.length})</span>
      </h3>

      {pending.length === 0 ? (
        <p style={{ color: "var(--text-muted)", fontSize: 13, marginBottom: 28 }}>Nothing waiting on review.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 28 }}>
          {pending.map((d) => (
            <div key={d.id} style={{ background: "var(--warning-bg)", border: "1px solid #fde68a", borderRadius: "var(--radius)", padding: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8, flexWrap: "wrap" }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <strong style={{ fontSize: 14 }}>{d.name}</strong>
                    <Badge tone="warning">Pending</Badge>
                  </div>
                  <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 3 }}>
                    {d.category} · {d.duration}m · submitted by {d.createdBy?.user.name ?? "Staff"}
                    {d.ageGroups.length > 0 && ` · ${d.ageGroups.map((a) => a.name).join(", ")}`}
                  </div>
                  {d.description && <p style={{ fontSize: 13, margin: "6px 0 0", color: "var(--text)" }}>{d.description}</p>}
                  <PhotoStrip urls={d.photos.map((p) => p.url)} />
                </div>
                {canApprove && (
                  <div style={{ display: "flex", gap: 6 }}>
                    <form action={approveDrill.bind(null, d.id)}>
                      <button type="submit" style={{ padding: "6px 12px", background: "var(--secondary)", color: "#fff", border: "none", borderRadius: 8, fontWeight: 700, fontSize: 12, cursor: "pointer" }}>
                        Approve
                      </button>
                    </form>
                    <ConfirmDeleteButton
                      action={rejectDrill.bind(null, d.id)}
                      confirmMessage={`Reject "${d.name}"? This deletes the suggestion and its feedback thread permanently.`}
                      label="Reject"
                    />
                    {canManage && (
                      <ConfirmDeleteButton
                        action={archiveDrill.bind(null, d.id)}
                        confirmMessage={`Archive "${d.name}"? It'll leave the review queue but stay in the Archived section, fully restorable.`}
                        label="Archive"
                      />
                    )}
                  </div>
                )}
              </div>

              {d.feedback.length > 0 && (
                <div style={{ marginTop: 10, background: "var(--surface)", borderRadius: 8, padding: 10 }}>
                  {d.feedback.map((f) => (
                    <div key={f.id} style={{ fontSize: 12, marginBottom: 4 }}>
                      <strong>{f.author.user.name}:</strong> {f.message}
                    </div>
                  ))}
                </div>
              )}

              {canSuggest && (
                <form action={addFeedback.bind(null, d.id)} style={{ display: "flex", gap: 6, marginTop: 10 }}>
                  <input name="message" placeholder="Add feedback..." required style={{ ...inputBase, flex: 1, fontSize: 12 }} />
                  <button type="submit" style={{ padding: "7px 14px", background: "var(--primary)", color: "#fff", border: "none", borderRadius: 8, fontWeight: 700, fontSize: 12, cursor: "pointer" }}>
                    Send
                  </button>
                </form>
              )}
            </div>
          ))}
        </div>
      )}

      <h3 style={{ fontSize: 16, margin: "0 0 12px" }}>
        Library <span style={{ color: "var(--text-faint)", fontWeight: 600 }}>({approved.length})</span>
      </h3>

      {approved.length === 0 ? (
        <EmptyState
          icon="drills"
          title="No approved drills yet"
          message="Approved suggestions will appear here and become available in session plans."
        />
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 10 }}>
          {approved.map((d) => (
            <div key={d.id} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "12px 14px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ width: 30, height: 30, borderRadius: 8, background: "var(--surface-muted)", color: "var(--secondary)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <Icon name="drills" size={15} />
                </span>
                <strong style={{ fontSize: 13.5 }}>{d.name}</strong>
              </div>
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 6 }}>
                {d.category} · {d.duration}m · {d.ageGroups.map((a) => a.name).join(", ")}
              </div>
              <PhotoStrip urls={d.photos.map((p) => p.url)} />
              {canPublishEdit && (
                <details style={{ marginTop: 8, borderTop: "1px solid var(--border)", paddingTop: 8 }}>
                  <summary style={{ cursor: "pointer", fontSize: 12, fontWeight: 700, color: "var(--secondary)", outline: "none" }}>Edit</summary>
                  <form action={updateDrill.bind(null, d.id)} style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
                    <input name="name" defaultValue={d.name} required style={{ ...inputBase, fontSize: 12.5, padding: "6px 9px" }} />
                    <div style={{ display: "flex", gap: 6 }}>
                      <select name="category" defaultValue={d.category} required style={{ ...inputBase, fontSize: 12.5, padding: "6px 9px", flex: 1 }}>
                        {CATEGORIES.map((c) => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                      <input name="duration" type="number" defaultValue={d.duration} required style={{ ...inputBase, fontSize: 12.5, padding: "6px 9px", width: 70 }} />
                    </div>
                    <input name="playerRange" defaultValue={d.playerRange ?? ""} placeholder="Player range" style={{ ...inputBase, fontSize: 12.5, padding: "6px 9px" }} />
                    <textarea name="description" defaultValue={d.description ?? ""} placeholder="Description" style={{ ...inputBase, fontSize: 12.5, padding: "6px 9px", minHeight: 54, resize: "vertical" }} />
                    <div>
                      <label style={{ display: "block", fontSize: 11, fontWeight: 700, marginBottom: 6, color: "var(--text-muted)" }}>Photos</label>
                      <DrillPhotoUpload name="photoUrls" current={d.photos.map((p) => p.url)} label="Add photos" />
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                      {ageGroups.map((ag) => (
                        <label key={ag.id} style={{ fontSize: 11.5, display: "inline-flex", alignItems: "center", gap: 4 }}>
                          <input type="checkbox" name="ageGroups" value={ag.id} defaultChecked={d.ageGroups.some((a) => a.id === ag.id)} /> {ag.name}
                        </label>
                      ))}
                    </div>
                    <button type="submit" style={{ alignSelf: "flex-start", padding: "6px 14px", background: "var(--primary)", color: "#fff", border: "none", borderRadius: 8, fontWeight: 700, fontSize: 12, cursor: "pointer" }}>
                      Save
                    </button>
                  </form>
                </details>
              )}
              {canManage && (
                <div style={{ marginTop: 8, paddingTop: 8, borderTop: "1px solid var(--border)", display: "flex", justifyContent: "flex-end" }}>
                  <ConfirmDeleteButton
                    action={archiveDrill.bind(null, d.id)}
                    confirmMessage={`Archive "${d.name}"? It'll leave the library and session-plan picker but stay in the Archived section, fully restorable.`}
                    label="Archive"
                    buttonStyle={{ display: "inline-flex", alignItems: "center", gap: 6, background: "transparent", border: "1px solid var(--border)", color: "var(--text-muted)", borderRadius: 8, cursor: "pointer", fontWeight: 700, fontSize: 11, padding: "4px 10px" }}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {canManage && archivedDrills.length > 0 && (
        <details style={{ marginTop: 28, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: 14 }}>
          <summary style={{ cursor: "pointer", listStyle: "none", display: "flex", alignItems: "center", gap: 8, fontSize: 14, fontWeight: 800, userSelect: "none" }}>
            <Icon name="drills" size={15} style={{ color: "var(--text-muted)" }} />
            Archived Drills
            <Badge tone="muted">{archivedDrills.length}</Badge>
          </summary>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 12 }}>
            {archivedDrills.map((d) => (
              <div key={d.id} style={{ background: "var(--surface-muted)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "10px 12px", opacity: 0.8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                      <strong style={{ fontSize: 13 }}>{d.name}</strong>
                      <Badge tone="muted">Archived</Badge>
                    </div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
                      {d.category} · {d.duration}m · archived {d.archivedAt!.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                    <form action={reactivateDrill.bind(null, d.id)}>
                      <button type="submit" style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "transparent", border: "1px solid var(--secondary)", color: "var(--secondary)", borderRadius: 8, cursor: "pointer", fontWeight: 700, fontSize: 11, padding: "4px 10px" }}>
                        Reactivate
                      </button>
                    </form>
                    <ConfirmDeleteButton
                      action={deleteDrill.bind(null, d.id)}
                      confirmMessage={`Delete "${d.name}" permanently? This removes it and its feedback thread for good. It's blocked while any session plan uses it.`}
                      label="Delete"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </details>
      )}
    </>
  );
}
