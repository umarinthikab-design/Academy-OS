// Server-only Web Push sending. Never imported from a client component -
// VAPID_PRIVATE_KEY must stay off the client bundle entirely.

import webpush from "web-push";
import { prisma } from "./prisma";

webpush.setVapidDetails(
  process.env.VAPID_SUBJECT!,
  process.env.VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
);

// Sends to every device this user has subscribed on (phone, laptop, etc -
// PushSubscription has no uniqueness per user, just per device). A single
// dead subscription failing never blocks the others - each send is
// independent and swallows its own error.
export async function sendPushToUser(userId: string, title: string, body: string, url: string) {
  const subscriptions = await prisma.pushSubscription.findMany({ where: { userId } });

  await Promise.all(
    subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify({ title, body, url })
        );
      } catch (err) {
        // 404/410 means the subscription is dead (uninstalled, expired,
        // revoked) - clean it up rather than retry forever or let dead rows
        // accumulate. Any other error (a transient network/service hiccup)
        // is swallowed too: a single failed push must never break whatever
        // action triggered it, and there's no retry queue for this yet.
        const statusCode = (err as { statusCode?: number })?.statusCode;
        if (statusCode === 404 || statusCode === 410) {
          await prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => {});
        }
      }
    })
  );
}
