
# 🏗️ Mickey — Site Truth, On Schedule

A real-estate fieldwork platform for photo-verified, geotagged, and timestamped task approvals. Built for India’s contractors, supervisors, and clients.

## ✨ Features

- 📸 **Photo Proof** — Every task ends with a photo, geotagged and timestamped
- 🗺️ **Geofence** — Only approve work on-site (150m radius)
- 👷 **Four-Step Approval** — Worker → Supervisor → Quality → Manager (→ Client)
- 🏢 **Org Branding** — Custom logo, color, and city for each org
- 🔒 **OTP Login** — Secure, passwordless sign-in (WhatsApp/SMS)
- 🏗️ **Sites & Teams** — Manage multiple sites, invite your team
- 🆓 **Free Trial** — First 50 tasks and 14 days free
- 💸 **Simple Pricing** — ₹49/worker/month after trial

## 🚀 Quick Start (Dev)

```sh
# Clone & install
pnpm install

# Start all apps (in separate terminals)
pnpm --filter @siteflow/api dev
pnpm --filter @siteflow/web dev
pnpm --filter @siteflow/field dev

# Seed database (if needed)
cd packages/db
pnpm exec drizzle-kit push --force
DATABASE_URL=postgres://siteflow:siteflow@localhost:5433/siteflow pnpm exec tsx src/seed.ts
```

- Web: [http://localhost:3000](http://localhost:3000)
- Field: [http://localhost:5174](http://localhost:5174)
- API: [http://localhost:4000](http://localhost:4000)

## 🏢 Monorepo Structure

- `apps/web` — Next.js 15, React 19, Tailwind (main landing, approvals, onboarding)
- `apps/field` — Vite, React 19 PWA (field worker app)
- `apps/api` — Fastify 5, Zod, Drizzle ORM (API server)
- `packages/db` — Drizzle schema, seed, migrations
- `packages/shared` — Shared types, schemas

## 🛠️ Tech

- TypeScript strict, pnpm, Node 22
- Postgres, MinIO (object store)
- MSG91 (OTP/WhatsApp, dev fallback to console)
- Mobile-first, PWA-ready

## 👤 Authors

- [@Phani3108](https://github.com/Phani3108)

---

> Built in Bengaluru for the people who actually build Bengaluru.

| Role | Login |
|---|---|
| Worker | `+919000000001` |
| Worker | `+919000000002` |
| Supervisor | `+919000000010` |
| Quality | `quality@siteflow.local` |
| Manager | `manager@siteflow.local` |
| Client | `client@siteflow.local` |
| CEO | `ceo@siteflow.local` |
| Accounts | `accounts@siteflow.local` |

### Full end-to-end loop to demo

1. **Field**: open <http://localhost:5174>, sign in as worker `+919000000001`.
2. Tap **▶ START** on the "Tile · Bath 2" task. Allow location when prompted.
3. Tap **📷 SUBMIT PROOF**. Allow camera. Aim, hit the amber shutter. (Photo is watermarked
   with task ID + GPS + timestamp before upload.)
4. **Web**: open <http://localhost:3000>, sign in as supervisor `+919000000010`
   (the web login accepts phone or email). Click **Approve** on the row.
5. Sign out, sign back in as `quality@siteflow.local` → approve → again as
   `manager@siteflow.local` → approve → finally `client@siteflow.local` →
   approve. The task is now `CLOSED` and disappears from every queue.

> Geofence check uses the site coordinates seeded for Prestige Tower B (Bengaluru
> 12.9698, 77.7499). If you're not in Bengaluru, the proof still uploads but is flagged
> as outside the fence; you'll see this in the UI message and in the `audit_events` table.

## Layout

```
siteflow/
├── apps/
│   ├── api/         Fastify backend (auth, tasks, proofs, approvals, S3 presign)
│   ├── field/       Vite + React PWA (worker / supervisor)
│   └── web/         Next.js 15 dashboard (quality / manager / client)
├── packages/
│   ├── db/          Drizzle schema + seed
│   └── shared/      Zod schemas, roles, task state machine, geo math
├── docker-compose.yml
└── .env.example
```

## Next milestones (in order)

1. **Auth swap**: real MSG91 OTP behind the existing `/auth/login` shape.
2. **Bulk approve + reject reason picker** on the web dashboard.
3. **Quality SOP** model + seed for top 10 trades + side panel on approval row.
4. **Client portal** route (`/client`) with read-only milestone view + acknowledge button.
5. **Temporal**: lift the state-machine call sites into `taskLifecycle.workflow.ts` and add
   the 4h escalation timer + delegation.
6. **Offline queue** on field PWA using IndexedDB + Background Sync.
7. **Terraform** for AWS Mumbai (RDS, ECS Fargate for api+temporal, S3+CloudFront).
