# NLOW Zoom Preview Report

A single-page tool for the "NLOW" webinar funnel team. The team uploads a set
of CSV exports (opt-ins, Zoom attendance, sales) after a live webinar; the
app crunches them client-side into a preview-report dashboard, an Excel
export, and WhatsApp broadcast lists (sent via WATI).

There is no AI/LLM integration anywhere in this app — it was previously
built and hosted on Perplexity Labs (`*.pplx.app`), and this repo is the
migration of that project to be developed with Claude Code going forward.
"Migrating from Perplexity to Claude" here means the *development
workflow*, not any in-app API call.

## Stack

- **Client**: React 18 + Vite, Tailwind, shadcn/radix UI components
  (`client/src/components/ui/*`), wouter for routing (hash-based).
- **Server**: Express (`server/`), thin — its only real job is to proxy
  WATI broadcast sends so the bearer token never reaches the browser. There
  is no database; `server/storage.ts` is an intentional no-op stub.
- All report generation (CSV parsing, metrics, Excel export) runs
  **client-side** in the browser, not on the server.
- TypeScript throughout, `@shared/*` path alias points at `shared/schema.ts`
  (single source of truth for the domain types used by both client and
  server).

## Where things live

- `client/src/pages/home.tsx` — the whole app UI: upload page + report page,
  in one file (large, ~1300 lines).
- `client/src/lib/reportGenerator.ts` — core business logic: parses the
  uploaded CSVs, matches opt-ins/registrants/attendees by email, buckets by
  country code, computes all the report metrics.
- `client/src/lib/csvParse.ts` — thin CSV parsing helpers (papaparse wrapper,
  handles CSVs with metadata rows before the real header row).
- `client/src/lib/excelExport.ts` — builds the downloadable multi-sheet
  Excel workbook (via `xlsx`) mirroring the report.
- `client/src/lib/watiBroadcast.ts` — builds the WATI broadcast contact
  lists (Welcome per intake month, No-Show-Up) from report data.
- `client/src/lib/phone.ts` — phone number normalization / country-code
  detection (SG/MY/HK/US/etc.).
- `client/src/components/BroadcastPanel.tsx` — UI for reviewing/sending a
  WATI broadcast.
- `shared/schema.ts` — all shared TypeScript types + zod schemas
  (`ReportData`, `SessionDetails`, broadcast request schema, etc.).
- `server/routes.ts` — the one real API route: `POST
  /api/wati/send-broadcast`, proxies to the WATI API using `WATI_BEARER`.
- `SPEC.md` — **stale, not authoritative for this repo.** It documents an
  unrelated sibling variant ("GEM Preview Report") from the old Perplexity
  workspace. Kept for historical reference only.

## Running locally

```bash
npm install
cp .env.example .env   # then fill in WATI_BEARER if you need broadcast sending to work
npm run dev             # tsx server/index.ts, serves client via Vite middleware, port 5000
npm run check            # tsc typecheck
npm run build             # client (vite) + server (esbuild) -> dist/
npm start                  # NODE_ENV=production node dist/index.cjs
```

The report-generation and Excel-export features work fully without any env
vars — only the WATI broadcast-send endpoint needs `WATI_BEARER`.

## Secrets

`WATI_BEARER` (WATI API bearer token) must come from the environment
(`.env`, gitignored) — never hardcode it in source. A previous version of
`server/routes.ts` had a live token checked into source as a fallback
default; that was removed during the migration to this repo. If the route
is called without `WATI_BEARER` set, it now returns a 500 instead of
silently sending an unauthenticated/broken request.

## Conventions / gotchas worth knowing before editing

- Country-code buckets (`SG`, `MY`, `USA`, `HK`, `OTHERS`, `INVALID`, `NA`)
  are used consistently across opt-ins, show-ups, and sign-ups — see
  `CountryGroup`/`CountryBreakdown` in `shared/schema.ts` and the detection
  logic in `phone.ts` / `reportGenerator.ts`.
- Zoom CSV exports have several metadata rows before the real header row —
  `csvParse.ts` / `reportGenerator.ts` handle skipping those; check the
  skip-row count if a new export format shows up.
- Everything in `reportGenerator.ts` matches records across CSVs **by
  email** (case-insensitive) — that's the join key between Keap opt-ins,
  Zoom registration/participants, and sales (ThriveCart/bank transfer).
- WATI sends go one contact at a time (concurrency-batched) — the bulk WATI
  endpoint was found to be unreliable for this template setup; see the
  comment in `server/routes.ts` before changing that.
