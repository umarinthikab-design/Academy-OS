// In-app notifications - the durable half of the notification story.
//
// Web push (lib/pushNotifications.ts) is best-effort reach: it only lands on
// devices that explicitly subscribed, and there's no record afterwards of
// what was sent or whether it arrived. This module owns the persistent side -
// one Notification row per recipient - so every message is listable in
// /notifications and countable for the unread badge.
//
// Two delivery modes, both used together by broadcastNotification():
//   - "inApp": write Notification rows. Always the source of truth.
//   - "push":  additionally call sendPushToUser. Best-effort.
//
// Every write here is wrapped so a notification failure can NEVER break the
// action that triggered it - same contract as logActivity() in
// lib/logActivity.ts.

import { prisma } from "./prisma";
import { sendPushToUser } from "./pushNotifications";

export type NotificationCategory =
  | "GENERAL"
  | "APPROVAL"
  | "ATTENDANCE"
  | "DRILL"
  | "SESSION"
  | "ANNOUNCEMENT";

export type Delivery = "inApp" | "push" | "both";

// Who a manual broadcast is aimed at. `AGE_GROUP` is only meaningful when
// `ageGroupId` is set; `EVERYONE` ignores it. Resolution rules live in
// resolveAudienceUserIds() below and deliberately exclude archived users.
export type Audience = "EVERYONE" | "COACHES" | "PARENTS" | "MANAGERS" | "AGE_GROUP";

export type AudienceOption = {
  value: Audience;
  label: string;
  description: string;
};

export const AUDIENCE_OPTIONS: AudienceOption[] = [
  { value: "EVERYONE", label: "Everyone", description: "All active coaches, parents and club staff." },
  { value: "COACHES", label: "Coaching staff", description: "Head and assistant coaches only." },
  { value: "PARENTS", label: "Parents", description: "Parents with a player in the academy." },
  { value: "MANAGERS", label: "Club staff", description: "Admins and club managers only." },
  { value: "AGE_GROUP", label: "An age group", description: "Coaches and parents attached to one age group." },
];

export const DELIVERY_OPTIONS: { value: Delivery; label: string; description: string }[] = [
  { value: "both", label: "In-app + push", description: "In the notifications list and as a device push." },
  { value: "inApp", label: "In-app only", description: "Appears in /notifications, no device push." },
  { value: "push", label: "Push only", description: "Device push for users who already opted in." },
];

// Icon name (components/ui/Icon.tsx) per category, so the inbox can colour and
// badge each notification without the category leaking into the UI layer.
export const CATEGORY_ICONS: Record<string, string> = {
  GENERAL: "bell",
  APPROVAL: "flag",
  ATTENDANCE: "attendance",
  DRILL: "drills",
  SESSION: "sessions",
  ANNOUNCEMENT: "alert",
};

// Archive-safe filters, copied from the recipient queries in
// lib/notifyApprovers.ts so a broadcast never reaches someone who can't sign in.
const ACTIVE_USERS = { archivedAt: null } as const;

export type BroadcastInput = {
  title: string;
  body: string;
  audience: Audience;
  ageGroupId?: string | null;
  delivery: Delivery;
  sentById: string;
  senderName: string;
  // Optional in-app destination (e.g. "/schedule") for a broadcast that's
  // really an announcement about a specific page.
  link?: string | null;
};

// Resolve a broadcast audience to concrete, non-archived user ids.
//
// `AGE_GROUP` fans out through both sides of the academy graph: coaches
// attached to the group (primary focus, or main/supporting on one of its
// batches) and the parents of players in its batches. Coaches with no batch
// link but a primary focus are still included so a group lead always hears
// about their own group.
async function resolveAudienceUserIds(audience: Audience, ageGroupId?: string | null): Promise<string[]> {
  if (audience === "EVERYONE") {
    const users = await prisma.user.findMany({ where: ACTIVE_USERS, select: { id: true } });
    return users.map((u) => u.id);
  }

  if (audience === "MANAGERS") {
    const users = await prisma.user.findMany({
      where: { ...ACTIVE_USERS, role: { in: ["ADMIN", "CLUB_MANAGER"] } },
      select: { id: true },
    });
    return users.map((u) => u.id);
  }

  if (audience === "COACHES") {
    const users = await prisma.user.findMany({
      where: { ...ACTIVE_USERS, role: { in: ["HEAD_COACH", "ASSISTANT_COACH"] } },
      select: { id: true },
    });
    return users.map((u) => u.id);
  }

  if (audience === "PARENTS") {
    const parents = await prisma.parent.findMany({
      where: { user: ACTIVE_USERS },
      select: { userId: true },
    });
    return parents.map((p) => p.userId);
  }

  // AGE_GROUP - requires a group to be meaningful; an empty set is safer than
  // silently broadcasting to the whole club.
  if (!ageGroupId) return [];

  const [coaches, parents] = await Promise.all([
    prisma.coach.findMany({
      where: {
        user: ACTIVE_USERS,
        OR: [
          { primaryFocus: { some: { id: ageGroupId } } },
          { mainBatches: { some: { ageGroupId } } },
          { supportingBatches: { some: { ageGroupId } } },
        ],
      },
      select: { userId: true },
    }),
    prisma.parent.findMany({
      where: {
        user: ACTIVE_USERS,
        players: { some: { batches: { some: { ageGroupId } } } },
      },
      select: { userId: true },
    }),
  ]);

  return [...new Set([...coaches.map((c) => c.userId), ...parents.map((p) => p.userId)])];
}

// Record one notification for a single user, in-app only. This is the hook the
// automatic (event-driven) notifications use - see notifyUser() below.
export async function recordNotification(input: {
  userId: string;
  title: string;
  body: string;
  category?: NotificationCategory;
  link?: string | null;
  sentById?: string | null;
  senderName?: string | null;
}): Promise<void> {
  try {
    await prisma.notification.create({
      data: {
        userId: input.userId,
        title: input.title,
        body: input.body,
        category: input.category ?? "GENERAL",
        link: input.link ?? null,
        sentById: input.sentById ?? null,
        senderName: input.senderName ?? null,
      },
    });
  } catch {
    // Never break the triggering action - same rationale as logActivity().
  }
}

// Fan a single-user notification out to both channels. Automatic events call
// this so an approval decision now lands in-app *and* as a push, rather than
// push-only as before.
export async function notifyUser(input: {
  userId: string;
  title: string;
  body: string;
  category?: NotificationCategory;
  link?: string | null;
}): Promise<void> {
  await recordNotification(input);
  try {
    await sendPushToUser(input.userId, input.title, input.body, input.link ?? "/notifications");
  } catch {
    // Push is best-effort; the in-app row is already written.
  }
}

// Send a manual broadcast. Returns the recipient count for the compose page's
// confirmation, or null when there was nothing to send (unknown audience or a
// selection that matched no one).
export async function broadcastNotification(input: BroadcastInput): Promise<number | null> {
  const userIds = await resolveAudienceUserIds(input.audience, input.ageGroupId);
  if (userIds.length === 0) return null;

  const writeInApp = input.delivery === "inApp" || input.delivery === "both";
  const push = input.delivery === "push" || input.delivery === "both";

  const category: NotificationCategory = input.audience === "EVERYONE" ? "ANNOUNCEMENT" : "GENERAL";

  if (writeInApp) {
    try {
      await prisma.notification.createMany({
        data: userIds.map((userId) => ({
          userId,
          title: input.title,
          body: input.body,
          category,
          link: input.link ?? null,
          sentById: input.sentById,
          senderName: input.senderName,
        })),
      });
    } catch {
      // If the durable write fails there's still a chance the push lands.
    }
  }

  if (push) {
    await Promise.all(
      userIds.map((userId) =>
        sendPushToUser(userId, input.title, input.body, input.link ?? "/notifications").catch(() => {})
      )
    );
  }

  return userIds.length;
}

export async function getUnreadCount(userId: string): Promise<number> {
  try {
    return await prisma.notification.count({ where: { userId, readAt: null } });
  } catch {
    // A missing/failed table must not break page render - the badge just
    // silently shows nothing.
    return 0;
  }
}

export type InboxItem = {
  id: string;
  title: string;
  body: string;
  category: string;
  link: string | null;
  readAt: Date | null;
  senderName: string | null;
  createdAt: Date;
};

export async function getInbox(userId: string, limit = 100): Promise<InboxItem[]> {
  try {
    return await prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
  } catch {
    return [];
  }
}

export async function markAllRead(userId: string): Promise<void> {
  try {
    await prisma.notification.updateMany({ where: { userId, readAt: null }, data: { readAt: new Date() } });
  } catch {
    // Best-effort.
  }
}

export async function markRead(userId: string, id: string): Promise<void> {
  try {
    // Scoped by userId so one user can never mark another's notification read
    // by guessing an id.
    await prisma.notification.updateMany({ where: { id, userId, readAt: null }, data: { readAt: new Date() } });
  } catch {
    // Best-effort.
  }
}