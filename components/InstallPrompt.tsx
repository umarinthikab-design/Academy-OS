"use client";

// InstallPrompt - a small, dismissible banner that nudges coaches to add
// Touchline to their home screen, shown once per browser session after login.
// - Android/Chrome: hooks the real `beforeinstallprompt` event and shows an
//   "Install" button that triggers the native prompt.
// - iOS Safari: no programmatic install trigger exists, so it shows text
//   instructions ("Share, then Add to Home Screen") instead. iOS is detected
//   via user-agent sniffing - acceptable here specifically because it's the
//   only reliable way to know which instructions to show; it's not used for
//   any feature logic elsewhere.
// - Never shows if the app is already running installed (display-mode
//   standalone) - no point prompting someone who already has it.

import { useEffect, useState } from "react";

const STORAGE_KEY = "touchline-install-prompt-dismissed";

type DeferredPrompt = { prompt: () => Promise<void>; userChoice?: Promise<unknown> };

export function InstallPrompt() {
  const [deferred, setDeferred] = useState<DeferredPrompt | null>(null);
  const [ios, setIos] = useState(false);
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (window.matchMedia("(display-mode: standalone)").matches) return; // already installed
    if (sessionStorage.getItem(STORAGE_KEY)) return; // dismissed this session

    const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent) && !(window as unknown as { MSStream?: unknown }).MSStream;
    setIos(isIos);

    const onBeforeInstall = (e: Event) => {
      e.preventDefault(); // don't auto-prompt; wait for our button
      setDeferred(e as unknown as DeferredPrompt);
      setShow(true);
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstall);

    // If the event fired (Chrome), show via the listener above. iOS never
    // fires it, so surface the instruction banner after a beat once the
    // layout has settled.
    if (isIos) {
      const t = setTimeout(() => setShow(true), 1200);
      return () => {
        clearTimeout(t);
        window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      };
    }
    return () => window.removeEventListener("beforeinstallprompt", onBeforeInstall);
  }, []);

  const dismiss = () => {
    sessionStorage.setItem(STORAGE_KEY, "1");
    setShow(false);
  };

  if (!show) return null;

  return (
    <div
      style={{
        position: "fixed",
        left: 14,
        bottom: 14,
        right: 14,
        zIndex: 900,
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius)",
        boxShadow: "var(--shadow-lg)",
        padding: "14px 16px",
        maxWidth: 380,
        margin: "0 auto",
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 4 }}>Install Touchline</div>
          {deferred ? (
            <p style={{ margin: "0 0 10px", fontSize: 13, color: "var(--text-muted)" }}>
              Get quick access with an app icon right on your home screen.
            </p>
          ) : ios ? (
            <p style={{ margin: "0 0 10px", fontSize: 13, color: "var(--text-muted)" }}>
              Tap <strong>Share</strong> <span aria-hidden style={{ fontSize: 11 }}>(the square-and-arrow icon)</span>, then{" "}
              <strong>Add to Home Screen</strong> to install Touchline.
            </p>
          ) : null}
          <div style={{ display: "flex", gap: 8 }}>
            {deferred && (
              <button
                type="button"
                onClick={async () => {
                  await deferred.prompt();
                  dismiss();
                }}
                style={{
                  padding: "8px 16px",
                  background: "var(--primary)",
                  color: "#fff",
                  border: "none",
                  borderRadius: 8,
                  fontWeight: 700,
                  fontSize: 13,
                  cursor: "pointer",
                }}
              >
                Install
              </button>
            )}
            <button
              type="button"
              onClick={dismiss}
              style={{
                padding: "8px 14px",
                background: "var(--surface-muted)",
                color: "var(--text-muted)",
                border: "none",
                borderRadius: 8,
                fontWeight: 700,
                fontSize: 13,
                cursor: "pointer",
              }}
            >
              Not now
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}