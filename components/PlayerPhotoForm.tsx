"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { updatePlayerPhoto } from "@/app/squad/actions";
import { PhotoUpload } from "./ui/PhotoUpload";
import { Button } from "./ui/Button";

function SavePhoto({ ready }: { ready: boolean }) {
  const { pending } = useFormStatus();
  return <Button size="sm" disabled={!ready || pending}>{pending ? "Saving..." : "Save photo"}</Button>;
}

export function PlayerPhotoForm({ playerId, current, returnTo }: { playerId: string; current?: string | null; returnTo?: string }) {
  const [ready, setReady] = useState(true);
  return (
    <form action={updatePlayerPhoto.bind(null, playerId)} style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 12 }}>
      <input type="hidden" name="returnTo" value={returnTo ?? "/squad"} />
      <PhotoUpload current={current} label="Choose player photo" onReadyChange={setReady} />
      <span style={{ fontSize: 13, color: "var(--text-muted)" }}>Choose a photo, confirm the crop, then save. You can also remove the current photo and save.</span>
      <SavePhoto ready={ready} />
    </form>
  );
}
