"use client";

// One-time display of a freshly-generated temporary password (see
// resetCoachPassword in app/coaches/actions.ts). The password arrives via a
// short-lived httpOnly cookie rather than the URL so it never lands in
// browser history or access logs. It self-expires in 60s regardless, and
// clicking Dismiss clears it immediately.
//
// Note: clearTempPassword must NOT run automatically on mount. A Server
// Action call refreshes the current route afterward, which would re-run the
// page's server component, find the cookie already gone, and unmount this
// banner before the admin has had a chance to read it - so the cookie is
// only ever cleared by the explicit, user-initiated Dismiss click below.

import { useState } from "react";
import { clearTempPassword } from "@/app/coaches/actions";

export function TempPasswordReveal({ email, password }: { email: string; password: string }) {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 6,
        background: "var(--warning-bg, #fff8e1)",
        border: "1px solid var(--warning, #b58a00)",
        borderRadius: 8,
        padding: "10px 14px",
        marginBottom: 16,
        fontSize: 13,
      }}
    >
      <div style={{ fontWeight: 700 }}>
        Temporary password for {email} — copy it now, it won&apos;t be shown again:
      </div>
      <code
        style={{
          fontSize: 14,
          fontWeight: 700,
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: 6,
          padding: "4px 8px",
          width: "fit-content",
          userSelect: "all",
        }}
      >
        {password}
      </code>
      <button
        type="button"
        onClick={() => {
          setDismissed(true);
          clearTempPassword();
        }}
        style={{
          alignSelf: "flex-start",
          fontSize: 11,
          padding: "4px 10px",
          borderRadius: 6,
          border: "1px solid var(--border)",
          background: "var(--surface)",
          color: "var(--text-muted)",
          cursor: "pointer",
        }}
      >
        Dismiss
      </button>
    </div>
  );
}
