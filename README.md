# Calendar Planner

A single-user web application that reads Google Calendar, parses free-text Plans via Gemini, and ranks candidate time slots with a rule-based scorer.

## Quick start (local development)

1. **Install dependencies** (pnpm is required):

   ```bash
   pnpm install
   ```

2. **Set up Google Cloud credentials** — follow [`docs/google-setup.md`](./docs/google-setup.md) to:
   - Create a Google Cloud project and enable the Calendar API
   - Create an OAuth client ID (Web application, redirect URI `http://localhost:3001/auth/callback`)
   - Copy `.env.example` to `.env` and fill in `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`

3. **Bootstrap the OAuth refresh token** (a one-time browser step):

   ```bash
   pnpm auth
   ```

   This opens a browser tab to Google's consent screen, captures the redirect, and writes `GOOGLE_REFRESH_TOKEN` to `.env`. Re-run if the token is ever revoked.

4. **Start the dev servers** (API on `:3001`, web on `:5173`):

   ```bash
   pnpm dev
   ```

5. Open `http://localhost:5173/` for the app, or `http://localhost:5173/__design` for the design system gallery.

## Commands

| Command | What it does |
|---|---|
| `pnpm dev` | Start API (Fastify) and web (Vite) with hot reload |
| `pnpm auth` | One-time OAuth bootstrap; writes refresh token to `.env` |
| `pnpm test` | Run all tests across the workspace |
| `pnpm typecheck` | TypeScript check across all packages |
| `pnpm build` | Production build of all packages |

## Project structure

```
apps/
├── api/                  Fastify backend (auth, calendar, plan parser, scorer)
└── web/                  Vite + React frontend (UI primitives, week grid, suggestions)
packages/
└── shared/               Domain types shared between api and web
docs/
├── adlc/                 Agentic Development Life Cycle docs
├── adr/                  Architectural Decision Records (0001–0004)
├── agents/               Agent configuration
└── google-setup.md       Step-by-step Google Cloud setup guide
.scratch/                 Issue tracker (slices) and design artifacts
```

## Design

The visual language is **Warm Calm** — a warm-tinted dark single-page calendar planner. The full design brief is in [`.scratch/design/calendar-planner/DESIGN-BRIEF.md`](./.scratch/design/calendar-planner/DESIGN-BRIEF.md) and the token file lives at `apps/web/src/tokens.css`.

## Issue tracking

Slices live in `.scratch/calendar-planner/issues/`. The parent PRD is `001-prd.md`; child slices are `002-bootstrap-monorepo.md` through `010-design-system-foundation.md`. Each slice ships on its own feature branch and merges to `main` via fast-forward — see [AGENTS.md § Git workflow](./AGENTS.md#git-workflow).
