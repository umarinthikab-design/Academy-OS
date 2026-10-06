// Public, unauthenticated-by-design endpoint: JotForm posts here directly on
// every registration submission, so there's no session cookie to check.
// Auth instead comes from a shared secret in the query string, verified
// before anything touches the database.
//
// JotForm's native webhook POST is multipart/form-data. Alongside a few
// submission-metadata fields (formID, submissionID, ...) it always includes
// a `pretty` field - a flattened, human-readable "Label:Value, Label:Value"
// summary of every answer, keyed by the question's on-form label rather than
// its internal field ID. Field-ID-based mapping (q3_name, q7_dateOfBirth,
// ...) would be more precise, but the exact IDs depend entirely on how this
// specific form is built and can't be known without a real submission from
// it - `pretty` is what lets this route map fields without guessing those
// IDs. If the live form's question labels don't resemble "name" /
// "birth"/"dob" / "emergency ... name" / "emergency ... phone", the heuristic
// below won't find them - that's fine by design, since rawPayload always
// keeps the complete original submission either way.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

import { safeEqual } from "@/lib/safeEqual";

export const runtime = "nodejs";

function parsePretty(pretty: string): Record<string, string> {
  const map: Record<string, string> = {};
  // JotForm separates answers with ", " and each is "Label:Value" - values
  // can themselves contain commas (e.g. addresses), so this can't be a
  // simple global split; splitting only on the label/value colon per
  // top-level segment is good enough for the fields this route cares about.
  for (const segment of pretty.split(/,\s*(?=[^,:]+:)/)) {
    const idx = segment.indexOf(":");
    if (idx === -1) continue;
    const label = segment.slice(0, idx).trim();
    const value = segment.slice(idx + 1).trim();
    if (label) map[label] = value;
  }
  return map;
}

function findField(fields: Record<string, string>, include: RegExp, exclude?: RegExp): string | undefined {
  for (const [label, value] of Object.entries(fields)) {
    if (!value) continue;
    if (include.test(label) && !(exclude && exclude.test(label))) return value;
  }
  return undefined;
}

function parseDate(value: string | undefined): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export async function POST(request: Request) {
  // Fail closed: if JOTFORM_WEBHOOK_SECRET is missing or empty, reject.
  const webhookSecret = process.env.JOTFORM_WEBHOOK_SECRET;
  if (!webhookSecret) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // Reject requests with Content-Length above 256 KB (413).
  // We check content-length before reading the body.
  const contentLength = request.headers.get("content-length");
  if (contentLength && parseInt(contentLength, 10) > 256 * 1024) {
    return NextResponse.json({ error: "payload too large" }, { status: 413 });
  }

  const url = new URL(request.url);
  const token = url.searchParams.get("token");

  // Compare token using constant-time comparison.
  if (!token || !safeEqual(token, webhookSecret)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let rawPayload: Record<string, unknown>;
  let pretty = "";
  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    rawPayload = await request.json();
    pretty = typeof rawPayload.pretty === "string" ? rawPayload.pretty : "";
  } else {
    // JotForm's default: multipart/form-data.
    const form = await request.formData();
    rawPayload = Object.fromEntries(form.entries());
    const prettyField = form.get("pretty");
    pretty = typeof prettyField === "string" ? prettyField : "";
  }

  const fields = pretty ? parsePretty(pretty) : {};
  const playerName = findField(fields, /name/i, /emergency|contact|parent|guardian/i);
  const dateOfBirth = parseDate(findField(fields, /birth|dob/i));
  const emergencyContactName = findField(fields, /emergency.*name|contact.*name/i);
  const emergencyContactPhone = findField(fields, /emergency.*phone|contact.*phone|emergency.*number/i);

  const registration = await prisma.pendingRegistration.create({
    data: {
      rawPayload: rawPayload as Prisma.InputJsonObject,
      playerName,
      dateOfBirth: dateOfBirth ?? undefined,
      emergencyContactName,
      emergencyContactPhone,
    },
  });

  return NextResponse.json({ ok: true, id: registration.id });
}
