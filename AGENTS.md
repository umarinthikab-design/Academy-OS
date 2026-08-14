# AGENTS.md — Touchline

Grassroots football academy management app. Next.js 15 (App Router) +
Prisma + Neon Postgres, deployed on Vercel, connected via GitHub
(`main` branch auto-deploys).

## Stack
- Next.js 15 / React 19, TypeScript
- Prisma 6 + Postgres (Neon, pooled connection — hostname ends in
  `-pooler`, required for serverless)
- Auth: `jose` JWT session cookie (`touchline_session`), `bcryptjs` for
  passwords
- No CSS framework — inline `style={{}}` + a few utility classes in
  `app/globals.css` (`.form-grid-2col`, `--pitch`/`--turf`/`--amber` vars)
- No test suite, no CI config

## Run it
```
npm install
npx prisma migrate dev
npm run seed          # optional sample data
npm run dev
```
`.env` needs `DATABASE_URL` (Neon pooled string) and `SESSION_SECRET`.

## Architecture
One folder per feature under `app/`: `page.tsx` (Server Component, fetches
via Prisma) + `actions.ts` (`"use server"` mutations). Every action:
1. Re-checks `getPermissions()` server-side — never trusts the UI.
2. On failure/invalid input: `redirect("/x?error=<code>")`, not a silent
   no-op — codes are mapped to copy in `components/StatusBanner.tsx`.
3. On success: `redirect("/x?success=<message>")`.
4. Mutating list pages render `<StatusBanner>` reading those query params,
   and use `<ConfirmDeleteButton>` (window.confirm wrapper) for deletes.

Auth: `middleware.ts` (Edge runtime, minimal — deliberately duplicates
constants from `lib/session.ts` rather than importing, since Prisma can't
run on Edge) verifies the JWT on every request except `/login`.
`lib/getSession.ts` reads it in Server Components/Actions.
`lib/permissions.ts::getPermissions()` is the single source of truth for
what a role/user can do — pages and actions both call it, never check
`session.role` directly. `HEAD_COACH` capabilities are per-coach flags on
the `Coach` row (admin-editable), not fixed by role.

## Data model (`prisma/schema.prisma`)
- **People**: `User` (login, `Role` enum: ADMIN/HEAD_COACH/ASSISTANT_COACH/PARENT)
  → `Coach` or `Parent`.
- **Structure**: `AgeGroup`, `Location`, `Batch` (batch has an age group,
  main coaches, players), `Player` (→ `PlayerSkill`).
- **Scheduling**: `ScheduledSession` (calendar slot: date/time/location/
  coaches) vs `Session` (a reusable drill plan, via `SessionDrill` →
  `Drill`) — separate entities, a `ScheduledSession` can optionally link
  one `Session`.
- **Drills**: `Drill` (PENDING/APPROVED) + `DrillFeedback` revision thread.
- **Built but unused in app code**: `PlayerAttendance`, `CoachAttendance`,
  `ApprovalRequest`, `ActivityLog`, `Session`/`SessionDrill` (no route
  exists for drill plans yet). Don't assume schema presence means a
  feature is live — check for a route under `app/` first.

## Known gaps (see full spec in prior build-prompt discussion if resuming that work)
No attendance tracking UI, no activity log writes, no private/shareable
coach sessions UI, no parent-facing pages (`PARENT` role resolves to an
empty permission set), Schedule loads all sessions with no date bound,
Squad has no filtering/pagination, no notifications of any kind.

## Conventions to follow when adding features
- Match the redirect+`StatusBanner`+`ConfirmDeleteButton` pattern above —
  don't reintroduce silent no-ops.
- Add new routes to `lib/navItems.ts`.
- Migrations: `npx prisma migrate dev --name <description>`.
- Keep `middleware.ts` Edge-safe — no Prisma import there.
