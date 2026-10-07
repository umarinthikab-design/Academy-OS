"use client";

import { useActionState, useState } from "react";
import { sendBroadcast, type BroadcastState } from "@/app/notifications/actions";
import { Field, Input, Select, Textarea } from "@/components/ui/Form";
import { Button } from "@/components/ui/Button";

const AUDIENCES = [
  { value: "EVERYONE", label: "Everyone" },
  { value: "COACHES", label: "Coaches" },
  { value: "PARENTS", label: "Parents" },
  { value: "MANAGERS", label: "Managers" },
  { value: "AGE_GROUP", label: "A specific age group" },
];
const DELIVERIES = [
  { value: "both", label: "In-app + push" },
  { value: "inApp", label: "In-app only" },
  { value: "push", label: "Push only" },
];

export default function NotificationBroadcastForm({
  ageGroups,
}: {
  ageGroups: { id: string; name: string }[];
}) {
  const [state, formAction, pending] = useActionState<BroadcastState, FormData>(sendBroadcast, {
    success: false,
  });
  const [audience, setAudience] = useState("EVERYONE");

  return (
    <form action={formAction} style={{ maxWidth: 520, marginTop: 24, display: "flex", flexDirection: "column", gap: 14 }}>
      {state.success && (
        <div role="status" style={{ background: "var(--success-bg)", color: "var(--success)", padding: "10px 14px", borderRadius: 8, fontSize: 13, fontWeight: 600 }}>
          Broadcast sent.
        </div>
      )}
      {state.error && (
        <div role="alert" style={{ background: "var(--error-bg)", color: "var(--error)", padding: "10px 14px", borderRadius: 8, fontSize: 13, fontWeight: 600 }}>
          {state.error}
        </div>
      )}
      <Field label="Title"><Input name="title" maxLength={120} required /></Field>
      <Field label="Message"><Textarea name="body" rows={4} maxLength={1000} required /></Field>
      <Field label="Audience">
        <Select name="audience" value={audience} onChange={(e) => setAudience(e.target.value)}>
          {AUDIENCES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </Select>
      </Field>
      {audience === "AGE_GROUP" && (
        <Field label="Age group">
          <Select name="ageGroupId" required defaultValue="">
            <option value="" disabled>Select an age group…</option>
            {ageGroups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
          </Select>
        </Field>
      )}
      <Field label="Delivery">
        <Select name="delivery" defaultValue="both">
          {DELIVERIES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </Select>
      </Field>
      <Button type="submit" disabled={pending}>{pending ? "Sending…" : "Send Broadcast"}</Button>
    </form>
  );
}