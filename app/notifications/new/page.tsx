"use client";

import React, { useState, useEffect } from "react";
import { prisma } from "@/lib/prisma";
import { getPermissions } from "@/lib/permissions";
import { broadcastNotification } from "@/lib/notifications";
import { PageHeader } from "@/components/ui/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { StatusBanner } from "@/components/StatusBanner";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input } from "@/components/ui/Form";
import { Textarea } from "@/components/ui/Form";
import { Button } from "@/components/ui/Button";

export default function NotificationsNewPage() {
  const [canSend, setCanSend] = useState<boolean | null>(null);
  const [perms, setPerms] = useState<any>(null);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [sent, setSent] = useState(false);

  // Check permissions on mount
  useEffect(() => {
    ;(async () => {
      const p = await getPermissions();
      setCanSend(p.isAdmin || p.isClubManager);
      setPerms(p);
    })();
  }, []);

  if (canSend === null) {
    return <p>Loading permissions...</p>;
  }
  if (!canSend) {
    return <p style={{ color: "var(--error)" }}>You don't have permission to send broadcasts.</p>;
  }

  // Gate: only admin + club manager can send broadcasts. (already checked)

  const handleSend = async () => {
    if (!title || !body) {
      return;
    }

    try {
      const userId = perms?.userId ?? "";
      await broadcastNotification({
        title,
        body,
        audience: "EVERYONE",
        ageGroupId: undefined,
        delivery: "both",
        sentById: userId,
        senderName: "Admin",
      });
      setSent(true);
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="p-6 max-w-2xl">
      <PageHeader title="Send Broadcast Notification" subtitle="Admin & club manager only" />

      <StatusBanner />

      <div style={{ marginTop: 24 }}>
        <Input value={title} onChange={(e) => setTitle(e.target.value as string)} required />
        <Textarea value={body} onChange={(e) => setBody(e.target.value as string)} rows={4} required />
        <Button type="button" style={{ width: "100%", marginTop: 16 }} onClick={handleSend} disabled={!title || !body}>
          Send Broadcast
        </Button>
      </div>
    </div>
  );
}