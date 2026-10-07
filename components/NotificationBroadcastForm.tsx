"use client";

import React, { useState } from "react";
import { Input } from "@/components/ui/Form";
import { Textarea } from "@/components/ui/Form";
import { Button } from "@/components/ui/Button";

type AudienceOption = 
  | { value: "EVERYONE"; label: string }
  | { value: "COACHES"; label: string }
  | { value: "PARENTS"; label: string }
  | { value: "MANAGERS"; label: string }
  | { value: "AGE_GROUP"; label: string };

type DeliveryOption = 
  | { value: "both"; label: string }
  | { value: "inApp"; label: string }
  | { value: "push"; label: string };

const AUDIENCE_OPTIONS: AudienceOption[] = [
  { value: "EVERYONE", label: "Everyone" },
  { value: "COACHES", label: "Coaches" },
  { value: "PARENTS", label: "Parents" },
  { value: "MANAGERS", label: "Managers" },
  { value: "AGE_GROUP", label: "Age Group" },
];

const DELIVERY_OPTIONS: DeliveryOption[] = [
  { value: "both", label: "In-app + push" },
  { value: "inApp", label: "In-app only" },
  { value: "push", label: "Push only" },
];

interface FormData {
  title: string;
  body: string;
  audience: string;
  delivery: string;
}

export default function NotificationBroadcastForm({
  onSuccess,
  onError,
}: {
  onSuccess: () => void;
  onError: (error: string) => void;
}) {
  const [state, setState] = useState({ success: false, error: null, title: "", body: "", audience: "EVERYONE", delivery: "both" });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const form = e.currentTarget as HTMLFormElement;
    const title = (form.elements.namedItem("title") as HTMLInputElement).value;
    const body = (form.elements.namedItem("body") as HTMLTextAreaElement).value;
    const audience = (form.elements.namedItem("audience") as HTMLSelectElement).value;
    const delivery = (form.elements.namedItem("delivery") as HTMLSelectElement).value;

    const response = await fetch("/api/broadcast", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        title,
        body,
        audience,
        delivery,
      }),
    });
    const data = await response.json();

    if (response.ok) {
      setState({ success: true, error: null, title, body, audience, delivery });
      onSuccess();
    } else {
      setState({ success: false, error: data.error ?? "Failed to send broadcast", title, body, audience, delivery });
      onError(data.error ?? "Failed to send broadcast");
    }
  };

  if (state.success) {
    onSuccess();
    return null;
  }

  if (state.error) {
    onError(state.error);
    return null;
  }

  return (
    <form onSubmit={handleSubmit} style={{ maxWidth: 400, marginTop: 24 }}>
      <Input
        placeholder="Title"
        maxLength={120}
        required
        value={state.title}
        onChange={(e) => 
          setState(s => ({ ...s, title: e.target.value }))}
      />
      <Textarea
        placeholder="Body"
        maxLength={1000}
        rows={4}
        required
        value={state.body}
        onChange={(e) => 
          setState(s => ({ ...s, body: e.target.value }))}
      />
      <select
        style={{ width: "100%", marginTop: 8, padding: "6px 10px" }}
        required
      >
        {AUDIENCE_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      <select
        style={{ width: "100%", marginTop: 8, padding: "6px 10px" }}
        required
      >
        {DELIVERY_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      <Button type="submit" style={{ width: "100%", marginTop: 16 }}>Send Broadcast</Button>
    </form>
  );
}