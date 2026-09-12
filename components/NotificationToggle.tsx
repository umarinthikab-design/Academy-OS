"use client";

// Push notification opt-in toggle. Lives in Settings (not a banner/prompt)
// because iOS refuses to grant notification permission unless the request
// comes from a direct user gesture - showing this as a toggle the user
// clicks themselves satisfies that, and Settings is already where personal
// preferences (theme) live.
//
// Only ever rendered when the app is running installed/standalone: on iOS,
// requesting permission before the PWA is added to the home screen silently
// fails (no prompt, no error, just nothing), so offering a control that
// can't work yet would be actively misleading. Android is more lenient
// about this, but branching platform behavior here isn't worth the
// complexity - same standalone check for both.

import { useEffect, useState } from "react";
import { subscribeToPush, unsubscribeFromPush } from "@/app/settings/actions";
import { Icon } from "./ui/Icon";

type Status = "checking" | "not-standalone" | "unsupported" | "off" | "on" | "denied";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

export function NotificationToggle() {
  const [status, setStatus] = useState<Status>("checking");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const isStandalone = window.matchMedia("(display-mode: standalone)").matches;
    if (!isStandalone) {
      setStatus("not-standalone");
      return;
    }
    if (!("PushManager" in window) || !("serviceWorker" in navigator)) {
      setStatus("unsupported");
      return;
    }
    if (Notification.permission === "denied") {
      setStatus("denied");
      return;
    }

    navigator.serviceWorker.ready
      .then((registration) => registration.pushManager.getSubscription())
      .then((sub) => setStatus(sub ? "on" : "off"))
      .catch(() => setStatus("off"));
  }, []);

  const enable = async () => {
    setBusy(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setStatus(permission === "denied" ? "denied" : "off");
        return;
      }

      const registration = await navigator.serviceWorker.ready;
      const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!publicKey) {
        setStatus("unsupported");
        return;
      }
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
      });

      const json = subscription.toJSON();
      await subscribeToPush({
        endpoint: json.endpoint!,
        keys: { p256dh: json.keys!.p256dh, auth: json.keys!.auth },
      });
      setStatus("on");
    } catch {
      // Subscription can fail for reasons outside the user's control (push
      // service unreachable, etc) - leave status as whatever it was rather
      // than claiming success.
      setStatus("off");
    } finally {
      setBusy(false);
    }
  };

  const disable = async () => {
    setBusy(true);
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        const endpoint = subscription.endpoint;
        await subscription.unsubscribe();
        await unsubscribeFromPush(endpoint);
      }
      setStatus("off");
    } finally {
      setBusy(false);
    }
  };

  if (status === "checking") return null;

  const copy: Record<Exclude<Status, "checking">, string> = {
    "not-standalone": "Install this app to your home screen first (Share → Add to Home Screen on iOS) - notifications only work from the installed app, not a browser tab.",
    unsupported: "Not supported on this browser.",
    denied: "Notifications are blocked for this app in your browser/device settings.",
    off: "Get notified about drill suggestions and session confirmations.",
    on: "Notifications enabled on this device.",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <p style={{ fontSize: 13, color: "var(--text-muted)", margin: 0 }}>{copy[status]}</p>
      {(status === "off" || status === "on") && (
        <button
          type="button"
          onClick={status === "on" ? disable : enable}
          disabled={busy}
          style={{
            alignSelf: "flex-start",
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "9px 14px",
            borderRadius: 8,
            border: "1px solid var(--border)",
            background: status === "on" ? "var(--surface)" : "var(--primary)",
            color: status === "on" ? "var(--text)" : "#fff",
            cursor: busy ? "default" : "pointer",
            fontWeight: 700,
            fontSize: 13,
            opacity: busy ? 0.7 : 1,
          }}
        >
          <Icon name="bell" size={16} />
          {busy ? "Working..." : status === "on" ? "Turn off notifications" : "Enable notifications"}
        </button>
      )}
    </div>
  );
}
