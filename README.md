# Academy OS — Football Academy Management Platform

## Touchline — Current Branding
This application is branded as **Touchline**, a football academy management platform. The system handles scheduling, roster management, attendance, and administrative workflows for youth academies.

## Overview
The current release is designed for internal academy stakeholders:
administrators, club managers, head coaches and assistant coaches.
Parent access is planned for the next release.

Academy administrators and coaches need a centralized system to manage player registrations, track attendance, schedule sessions, and manage academy operations — without the complexity of enterprise software or the risk of scattered spreadsheets.

## Current Capabilities

### User Roles
- **Admin** — Full access to all pages and administration features
- **Club Manager** — Administrative oversight without account-management privileges
- **Head Coach** — Session scheduling, squad management, drill creation
- **Assistant Coach** — Session execution, attendance taking

### Planned for the Next Release
- **Parent** — View own child's sessions and attendance; limited profile access

### Core Features (code-review verified)
- Player registration and roster management
- Session scheduling and planning
- Attendance tracking and status management
- Drill library and creation
- Pre-session participation confirmations for assigned coaches
- Attendance proposal and approval workflow
- Squad management and player profiles
- Age group and batch organization
- Attendance and session logging
- Note-taking on players
- Notification system for broadcast messages (admin/club manager only)

### Authentication & Access
- Session-based authentication with JWT
- Role-based page access controls
- Password reset and forced-change flow
- Session revocation capability
- Demo accounts available via `npm run seed:demo`

## Technology Stack

### Frontend
- **Next.js 15** — App Router framework with Server Components
- **React 19** — UI library
- Custom CSS — Design tokens, layout, and shared UI components defined in `app/globals.css` with CSS variables, layout utilities, and form/helpers. No Tailwind configuration or directives are present in the codebase.

### Backend & Database
- **Prisma ORM** — Type-safe database client
- **PostgreSQL** — Relational database (Neon.tech or Supabase)
- **Node.js** — Runtime environment

### Infrastructure
- **Vercel** — Deployment and hosting platform
- **Web Push** — Push notification service (VAPID keys)
- **JotForm webhook** — Registration form integration

## Architecture
The application uses a **Server Components** architecture where data-fetching happens on the server, and interactive elements use Client Components. Authentication state flows through JWT tokens signed with a session secret. Database operations go through Prisma Client with application-level permission checks in API routes.

## Live Application
**https://touchline-app-exp.vercel.app**

Authentication is required to access the application. Demo accounts can be created via `npm run seed:demo`.

## Local Development Setup

### Prerequisites
- Node.js LTS version
- PostgreSQL database (Neon.tech or Supabase recommended)

### Environment Variables
Copy `.env.example` to `.env` and set the following (recommended: separate dev and prod `.env` files):

- `DATABASE_URL` — PostgreSQL connection string (recommended: separate dev and prod databases)
- `DIRECT_URL` — Prisma direct connection string for raw database operations
- `NEXT_PUBLIC_VAPID_PUBLIC_KEY` — VAPID public key for push notifications (frontend-safe)
- `VAPID_PRIVATE_KEY` — VAPID private key for push notifications (server-side only)
- `VAPID_SUBJECT` — VAPID subject identifier
- `CRON_SECRET` — Authenticates scheduled cron requests (not the JotForm webhook)
- `JOTFORM_WEBHOOK_SECRET` — Secret for JotForm webhook verification; must match the secret configured in JotForm's webhook URL (`?token=<value>`)
- `BLOB_READ_WRITE_TOKEN` — Token for Vercel Blob read/write operations
- `SESSION_SECRET` — Random string for JWT signing

### Setup Commands
```bash
npm install
npx prisma migrate deploy
npm run seed:demo
npm run dev
```

Open **http://localhost:3000** to view the application.

### Separate Databases Recommended
- Use **different database URLs** for development and production environments
- Never share the production database connection string in development
- Seed data should use demo suffixes (e.g., `@demo.touchline.local`) to avoid affecting production data

## Current Limitations
- Push notification delivery best-effort (depends on user subscription status)
- Real-time features limited to push notifications; no WebSocket polling
- Some advanced analytics and reporting features pending implementation

## Development Status
- Active development in progress
- TypeScript compilation verified (`npx tsc --noEmit` passes with zero errors)
- Prisma schema migration system operational
- GitHub repository: `umarinthikab-design/Academy-OS`
- Vercel deployments from `main` branch

## Author
**Umar Inthikab**

---

**Note:** This README reflects the current code state as of the latest review. Features and status may have changed since initial repository creation. For the most current state, refer to the GitHub repository and recent commits.