# Mario — Proof, not promises.

> A flat takes a year to build. About four minutes to inspect. We changed the math.

Mario is the **proof layer for residential real estate.** Every tile, every coat, every fitting — photographed on site, geofenced to the square metre, approved by four people who put their name on it. The result is buildings clients trust on the day they hand over keys.

Launch market: **Hyderabad.** Expandable to any developer in any city.

---

## Why developers switch to Mario

| | |
|---|---|
| **The photograph that doesn't lie.** | Every proof is watermarked client-side with task ID, GPS, and timestamp **before** it leaves the employee's phone. By the time it reaches your dashboard, it's already too honest to argue with. |
| **Four signatures. Four levels of conscience.** | Supervisor → Quality → Manager → Client. Each one signs with their name. After three rejections, the task escalates automatically. Defects don't walk past four people. |
| **Payroll that matches reality.** | Hours billed are hours photographed on site. Inside the geofence, or you don't get the minute. The math at the end of the month is the math the foreman saw at the end of the day. |

---

## What's in the box

- 📸 **Photo proof** — capture, blur-check, GPS+timestamp watermark, presigned S3 upload
- 🗺️ **Geofence (150 m default, per-site override)** — haversine distance computed server-side
- ✅ **Four-step approval state machine** with auto-skip for non-sampled quality and auto-escalation on three rejects
- 🏢 **Org branding** — logo upload, accent colour, primary city, currency, geofence default
- 🧑‍🔧 **Sites & crews** — N projects per org, supervisor + employees per site, desk roles (quality / manager / client / CEO / accounts)
- 📋 **SOP library** — six trades pre-seeded with instructions, required tests, sample rate
- ⏱️ **Timesheets** — punch in/out with selfie and GPS, lunch breaks, geofence flag
- 💰 **Finance** — contracts, hourly cost-rates per role, site P&L, payroll CSV export
- 📤 **WhatsApp outbox** — every task notification logged (MSG91 wire-in stubbed for dev)
- 🔐 **OTP signup + dev-login bypass** — real MSG91 path exists; dev mode prints code to console

---

## 🌐 Live demo

**[mario-ashy.vercel.app](https://mario-ashy.vercel.app)** runs the web app with the **DEMO MODE** flag on — there is no backend wired up, but the entire UI is functional. Five seeded Hyderabad projects, 34 tasks across every state, working +New Task, working approval chain, working logo upload (in-browser only). Look for the green `DEMO MODE` chip in the top bar.

### Deploying your own to Vercel

The Next.js dashboard lives at `apps/web/`, not the repo root. The committed `vercel.json` already handles this — connect the repo in Vercel, leave **Root Directory** blank, and Vercel will run:

```
pnpm install --frozen-lockfile && pnpm --filter @siteflow/web build
```

with `NEXT_PUBLIC_DEMO=true` baked into the build. To point the deployed web app at a real API instead, set these env vars in the Vercel project:

| Var                       | Value                                  |
|---------------------------|----------------------------------------|
| `NEXT_PUBLIC_DEMO`        | `false`                                |
| `NEXT_PUBLIC_API_URL`     | `https://api.yourdomain.com`           |

(If your Vercel project was previously configured to deploy `apps/field`, change the project's **Root Directory** back to empty so `vercel.json` at the repo root takes over.)

---

## 🚀 Quick start (one command, local dev)

```sh
# Requires: Node 22, pnpm 9, Docker Desktop
git clone https://github.com/Phani3108/Mario
cd Mario/siteflow
cp .env.example .env

pnpm bootstrap        # installs deps, brings up Postgres + MinIO, pushes schema, seeds demo data
pnpm dev              # starts api + web + field with prefixed logs
```

Then open:

| App   | URL                       | What's there                         |
|-------|---------------------------|--------------------------------------|
| Web   | http://localhost:3000     | Landing + onboard + desk dashboard   |
| Field | http://localhost:5174     | Employee / supervisor PWA              |
| API   | http://localhost:4000     | Fastify + Drizzle                    |
| MinIO | http://localhost:9001     | S3 console (`siteflow` / `siteflowsecret`) |

**API readiness gate:** the API hard-fails at boot if Postgres or MinIO is unreachable, with a one-line "try `pnpm infra:up`" hint. No more silent `Failed to fetch`.

---

## 🔐 Dev sign-in (no OTP needed)

`DEV_AUTH=true` in `.env` enables a dev login that accepts any seeded account with `devCode: '000000'`. Both the web landing page and the field PWA show preset buttons for **all seven personas** (Employee, Supervisor, Quality, Manager, Accounts, CEO, Client) — pick one, click Sign in, you're in.

| Role        | Login                       | Site                              |
|-------------|-----------------------------|-----------------------------------|
| Employee      | `+919000000111` (R. Kumar)  | My Home Bhooja – Tower 4          |
| Employee      | `+919000000131` (J. Rao)    | Rajapushpa Atria – Phase 2        |
| Supervisor  | `+919000000110` (P. Singh)  | My Home Bhooja – Tower 4          |
| Supervisor  | `+919000000140` (H. Iyer)   | Prestige High Fields – Tower 6    |
| Quality     | `quality@siteflow.local`    | (org-wide)                        |
| Manager     | `manager@siteflow.local`    | (org-wide)                        |
| Client      | `client@siteflow.local`     | (org-wide)                        |
| CEO         | `ceo@siteflow.local`        | (org-wide)                        |
| Accounts    | `accounts@siteflow.local`   | (org-wide)                        |

Set `DEV_AUTH=false` to lock the door and require the real MSG91 OTP path.

### What each persona sees (role-filtered dashboards)

The sidebar narrows to the persona's actual job — nobody gets a tab they can't act on. Each persona has a **purpose-built default landing view** as well, not just a filtered nav.

| Persona | Default landing | Sidebar |
|---|---|---|
| **Employee**   | My tasks               | My tasks |
| **Supervisor** | Approvals (mobile cards) | Approvals · Tasks · Timesheets · People · Rework |
| **Quality**    | Approvals (table + SOP REFERENCE side-panel + ⇧A/⇧R/J/K shortcuts) | Approvals · SOP library · Rework · Tasks |
| **Manager**    | Command center (KPIs + portfolio + escalations + activity) | Command · Approvals · Tasks · Timesheets · SOP · Rework · Payroll · Reports · Sites · People · Outbox |
| **Accounts**   | Payroll & finance (KPIs + employee roll-up + rate editor + CSV export) | Payroll · Timesheets · Reports · People · Outbox |
| **CEO**        | Executive overview (portfolio P&L · burn · on-schedule · quality reject %) | Command · Payroll · Reports · Sites · People · Outbox · Tasks · Approvals |
| **Client**     | `/client` portal (auto-redirected from `/approvals`) | Overview · Milestones · Evidence gallery · Snag list · Quality reports |

**Bilingual everywhere.** `EN | हिं` toggle in every header (landing, dashboard, settings, onboard, client portal) — toggle on the worker phone, the desk dashboard speaks Hindi too (same `sf_lang` localStorage key).

**Dark + light theme.** `☀ | ☾` toggle next to the language toggle. Persists per-browser. The Quality dashboard in particular has the dark variant from mockup #7.

**+ New task is everywhere.** Every role except Client can author tasks — the modal POSTs `/tasks` and is summonable from the top-bar button on every dashboard, plus inline buttons inside each role view.

### Adding a project

- **Logged in?** Click `+ Add a project` on the landing — or `+ New project` in the dashboard top bar — and a single modal asks for name, address, lat/lng, geofence radius. POSTs `/sites`. Done.
- **First-time signup?** `+ Add a project` opens the 5-step org wizard at `/onboard`. In demo mode the phone-OTP step is **skipped entirely** with a green banner; everywhere else it sends a real MSG91 OTP (when keys are wired).

---

## 🌆 Seeded projects (Hyderabad)

One org — **Sunrise Builders Pvt Ltd** — across five real Hyderabad residential developments. Each is geofenced to its actual neighbourhood:

| Project                                | Neighbourhood   | Lat, Lng              | Crew (1 sup + 3 employees) | Tasks |
|----------------------------------------|-----------------|-----------------------|--------------------------|-------|
| My Home Bhooja – Tower 4               | Hitech City     | 17.4474, 78.3762      | P. Singh + 3             | 7     |
| Aparna Sarovar Zenith – Block B        | Nallagandla     | 17.4732, 78.3142      | V. Reddy + 3             | 6     |
| Rajapushpa Atria – Phase 2             | Kokapet         | 17.4126, 78.3343      | K. Murthy + 3            | 7     |
| Prestige High Fields – Tower 6         | Gachibowli      | 17.4401, 78.3489      | H. Iyer + 3              | 8     |
| Sumadhura Acropolis – Penthouse Block  | Gachibowli      | 17.4378, 78.3520      | D. Pillai + 3            | 6     |

Tasks span the full state machine (`DRAFT`, `ASSIGNED`, `IN_PROGRESS`, `PROOF_SUBMITTED`, `REWORK`, `MANAGER_APPROVED`, `CLOSED`) so every dashboard view has data on day one.

---

## 🧪 End-to-end demo loop

1. **Web**: open <http://localhost:3000>, click **Supervisor** on the login card → lands on dashboard, sees **My Home Bhooja – Tower 4** in the sidebar.
2. **Field**: open <http://localhost:5174>, dev-login as employee `+919000000111`. Tap **▶ START** on an `IN_PROGRESS` task. Allow geolocation when prompted.
3. Tap **📷 SUBMIT PROOF**, allow camera, capture a frame. (Desktop webcams work too — the proof is watermarked with task ID + GPS + timestamp before upload.)
4. **Web → Approval queue** as `+919000000110` (supervisor) → click ✓ → state advances to `SUPERVISOR_APPROVED`.
5. Sign out → sign in as `quality@siteflow.local` → approve → as `manager@siteflow.local` → approve → as `client@siteflow.local` → approve. State: `CLOSED`.
6. **+ New task** from the **Tasks** tab — pick a project, trade, date range, optional SOP and assignee. The new task appears in the supervisor's queue once the assignee submits proof.

> Geofence note: when running locally with no GPS, the proof still uploads but is flagged `insideGeofence=false` and surfaced as ⚠ in the timesheet view. The hardware check is sound; only the demo's GPS is fake.

---

## 🏢 Monorepo layout

```
siteflow/
├── apps/
│   ├── api/         Fastify 5 + Zod + Drizzle  (port 4000)
│   ├── web/         Next.js 15 + Tailwind      (port 3000)
│   └── field/       Vite + React PWA           (port 5174)
├── packages/
│   ├── db/          Drizzle schema + seed (Hyderabad demo)
│   └── shared/      Zod, roles, task state machine, geo helpers
├── docker-compose.yml   Postgres + Redis + MinIO + bucket bootstrap
└── .env.example
```

---

## 🛠️ Stack

- **Language:** TypeScript strict throughout
- **Runtime:** Node 22, pnpm 9 workspaces
- **API:** Fastify 5, `@fastify/jwt`, `@fastify/cors`, `fastify-type-provider-zod`
- **DB:** Postgres 16, Drizzle ORM, `drizzle-kit push` (no migration drift in dev)
- **Object store:** MinIO (S3-compatible) for proofs, selfies, org logos, SOP reference media
- **Frontend:** Next.js 15 App Router, Tailwind 3 with the `mario.*` palette, Source Serif Pro for Ogilvy long-copy
- **Field:** Vite + React PWA, IndexedDB offline queue, geolocation + camera + watermark client-side
- **Notifications:** MSG91 (OTP + WhatsApp) — real call when keys set, console fallback otherwise

---

## 🎨 Brand

The Mario mark is a builder's **"M"** — two plumb-strings for the verticals, a spirit level across the top with a centered bubble, plumb-bobs at the base. Slate + saffron — the colours of a confident Indian real-estate brand. The favicon and dashboard logo live in `apps/web/src/components/MarioLogo.tsx` and `apps/web/public/brand/favicon.svg`.

---

## ⚙️ Useful scripts

```sh
pnpm bootstrap      # full reset: deps + docker + schema + seed
pnpm dev            # api + web + field, prefixed logs
pnpm infra:up       # just docker (Postgres + MinIO + Redis)
pnpm infra:down     # stop docker services
pnpm db:push:force  # push schema (drops conflicts — dev only)
pnpm db:seed        # re-run the Hyderabad seed (idempotent)
pnpm typecheck      # tsc --noEmit across all workspaces
pnpm build          # production build of all packages
```

---

## 🛣️ Production readiness — what's deferred

Local dev is bulletproof. Before shipping to a real cloud, wire these in:

1. **MSG91** — set `MSG91_AUTH_KEY` + `MSG91_OTP_TEMPLATE_ID` in env, flip `DEV_AUTH=false`.
2. **JWT rotation** — replace the default `JWT_SECRET`; fail-fast in non-dev if still the default.
3. **Rate limit `/auth/otp/*`** — add `@fastify/rate-limit` to defend against OTP spam.
4. **Dockerfile** for `apps/api` (web is a Next.js standalone build; field is a Vite static bundle).
5. **Deploy target** — Render / Fly / Railway for the API; Vercel for web; CloudFront + S3 for field PWA.
6. **CORS** — set `API_CORS_ORIGINS` to your deployed web + field origins.
7. **Backups** — managed Postgres (RDS / Neon / Supabase) with PITR; lifecycle policy on the proof bucket.

---

## 👤 Author

[@Phani3108](https://github.com/Phani3108) — built for the people who actually build Indian cities.
