// RegistrationsInbox - "Pending registrations" dashboard section, same
// visual pattern as ApprovalInbox (header + StatusPill count) so it reads as
// part of the same "things awaiting your review" language, without actually
// being wired into the generic ApprovalRequest machinery ApprovalInbox uses -
// PendingRegistration is its own model with its own review flow
// (app/registrations), same relationship DrillStatus PENDING has to the
// approvals system: adjacent, not merged in.

import { prisma } from "@/lib/prisma";
import type { Permissions } from "@/lib/permissions";
import { Icon } from "@/components/ui/Icon";
import { StatusPill } from "@/components/ui/StatusPill";

export async function RegistrationsInbox({ perms }: { perms: Permissions }) {
  if (!(perms.isAdmin || perms.isClubManager)) return null;

  const count = await prisma.pendingRegistration.count({ where: { status: "PENDING" } });
  if (count === 0) return null;

  return (
    <a
      href="/registrations"
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: 12,
        flexWrap: "wrap",
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-lg)",
        boxShadow: "var(--shadow-sm)",
        padding: "18px 20px",
        textDecoration: "none",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <div style={{ width: 42, height: 42, borderRadius: 10, background: "var(--surface-muted)", color: "var(--secondary)", border: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <Icon name="squad" size={18} />
        </div>
        <div>
          <h2 style={{ fontFamily: "var(--font-headline)", fontSize: 18, fontWeight: 600, color: "var(--primary)" }}>Pending registrations</h2>
          <p style={{ margin: "2px 0 0", fontSize: 13, color: "var(--text-muted)" }}>New sign-ups from the registration form awaiting review.</p>
        </div>
      </div>
      <StatusPill tone="pending">{count} pending</StatusPill>
    </a>
  );
}
