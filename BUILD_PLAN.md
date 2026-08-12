# Build Plan — Multi-Team NHL Streak Game

This is a **new, separate project** from Leafs Legend. Leafs Legend stays its own
project: its live deployment is frozen as v1 during this build, and the good
parts of its code (game loop, ETL) are ported into this new repo once. `teams.ts`
(provided separately in this message) is the theme + metadata config this project
depends on.

**How to use this plan:** work one phase at a time, in plan mode, and check in
before moving to the next. Do NOT build later phases early. Update `CLAUDE.md`
with the cross-cutting principles below before starting Phase 1.

---

## Cross-cutting principles (apply to every phase)

1. **Guest-first. Accounts are never required.** The full game must work with no
   login. Signing in only *adds* persistence — never gates play behind a wall.

2. **Site name is a config constant, currently undecided.** Put it in one place
   (e.g. `SITE_NAME` in a config file) and reference that everywhere. Do not
   hardcode a name anywhere; it will be chosen later.

3. **Isolate the answer check in one shared module.** The "did this player play
   for team X?" logic lives in a single function used by the whole app. This is
   what lets it move server-side later without a rewrite (needed for cheat-proof
   leaderboards and 1v1). Never scatter answer logic across components.

4. **Player selection is seed-driven.** A run's sequence of players is generated
   from a seed via deterministic RNG — not `Math.random()` per pick. This costs
   little now and later enables replay/verification of a run, shareable daily
   challenges, and identical sequences for two players in 1v1. Build it in now.

5. **Per-team routes** (`/[team-slug]`) for SEO and shareability — each team is
   its own indexable, linkable page, not just a dropdown state.

6. **Ship phase by phase.** Each phase ends deployed and testable.

7. **Do not touch the live Leafs Legend v1 during this build.** It stays deployed
   and stable (it's on public/LinkedIn links). This new project is built
   separately; the cutover + redirect happens in Phase 4, not before.

---

## Phase 1 — Scaffold, port, and parameterize

This is a fresh repo. Stand it up clean, port the proven pieces from Leafs
Legend, then generalize to all 32 teams via `teams.ts`.

- Scaffold the new Next.js + TypeScript + Tailwind project from scratch (clean
  structure, `/etl` and `/web` as planned).
- **Port from Leafs Legend, don't rewrite from memory:** bring over the game loop
  (streak logic, decade selector, guess UI) and the ETL, then refactor as below.
  Port once; do not keep syncing with the old repo afterward.
- Team becomes a parameter throughout; remove all Leafs hardcoding during the
  port.
- Landing page: a grid/switcher of all 32 teams (use `TEAMS` / `TEAM_CODES`).
- Route `/[team-slug]` renders the game themed for that team via
  `applyTeamTheme()` → CSS variables (`--team-primary`, etc.).
- **ETL / data change:** `players.json` must generalize. Instead of a Leafs-only
  flag, each player carries the set of teams they played for (and decades), and
  the answer check is "is the active team in this player's team set?" See Data
  Model below. Re-run the ETL to produce the generalized dataset; spot-check a
  multi-team player (e.g. a player traded between two teams shows both).
- Keep the streak loop, decade selector, localStorage best-streak.

Ships as: a working game for all 32 teams, each on its own themed page — while
Leafs Legend v1 stays live and untouched.

## Phase 2 — Accounts + stats (Supabase, non-intrusive)

- **Supabase Auth** for optional sign-in. Next.js API routes / server actions +
  Supabase Postgres — no separate FastAPI service.
- Guests keep using localStorage. On first sign-in, offer to import their
  local best streaks into their account.
- **Non-intrusive UX:** no modal walls. A subtle, dismissible "sign in to save
  your stats" affordance. Playing never requires an account.
- **Stats (chess.com-style profile):** per-team and overall — best streak,
  games played, average streak, favourite team (user-set). A profile page
  showing these per team.
- Note: at this stage stats are client-reported, which is fine for personal
  stats. Do not build public competitive leaderboards yet (see Phase 3).

## Phase 3 — Leaderboards (decision point)

Before building, decide: **casual or competitive?**

- **Casual** (personal bests, friends): trust the client, store runs in
  Supabase. Simple, low-stakes.
- **Competitive** (global public board): the client can fabricate streaks, so
  the server must be authoritative — validate submitted runs by replaying the
  seed-driven sequence against a server-side copy of the answer data (this is
  why principles 3 and 4 exist). Only take this on when it's worth it.

Recommend starting casual (per-team personal-best boards) and adding server
validation only when going competitive.

## Phase 4 — Custom domain, SEO, and Leafs Legend cutover

- Point the chosen domain (name TBD) at Vercel; move `SITE_NAME` and any
  env/OG config over.
- Per-team pages get proper metadata + Open Graph tags (title, description,
  image, url) so links preview correctly and pages can rank (e.g. searches like
  "<team> quiz"). Add a sitemap.
- **Cut over Leafs Legend v1:** once the new site is solid, 301-redirect the old
  Leafs Legend production URL to the new `/maple-leafs` page, then retire the v1
  deployment. The redirect preserves already-shared links (LinkedIn, etc.) and
  passes their SEO value to the new site instead of discarding it.
- Add privacy-respecting analytics.

## Phase 5 — Monetization (Google AdSense)

**Depends on Phase 4** — AdSense generally needs a real custom domain (not a
`*.vercel.app` subdomain) plus a privacy policy and, for EU/Canada, cookie
consent for ad personalization.

- Add a privacy policy page and a consent banner before enabling ads.
- Place ad units where they don't interrupt the game loop (avoid mid-run).
- Keep expectations realistic: at low traffic this is proof-of-concept, not
  income. Don't compromise UX for it.

## Phase 6 (near future) — Faceoff (1v1)

Real-time head-to-head — a distinct, heavier phase.

- Both players get the **same seed-driven sequence** (principle 4). Match state
  and answer validation are **server-authoritative** (principle 3) — never trust
  a client in PvP.
- Needs realtime (Supabase Realtime or websockets) + basic matchmaking/lobby.
- A rating system (Elo-style) fits naturally here and can extend the Phase 2
  stats model.
- Design earlier phases so nothing blocks this; don't build it until the
  single-player experience and accounts are solid.

---

## Data model notes

**`players.json` (generalized, Phase 1):**
```json
{
  "id": 8478483,
  "name": "Example Player",
  "position": "C",
  "teams": ["TOR", "BOS"],          // NHL API abbrevs; keys match teams.ts
  "decadesActive": ["2010s", "2020s"],
  "teamDecades": { "TOR": ["2010s"], "BOS": ["2020s"] }
}
```
Answer check: `player.teams.includes(activeTeamCode)`. Keep `teamDecades` so the
decade-specific game mode ("played for this team *in* this decade") stays
possible later.

**User stats (Phase 2, Supabase):** per (user, team) row with best streak, games
played, sum/avg streak; plus a user row for favourite team and overall
aggregates. Extend with a rating column when Faceoff lands.

---

## What to do first

Start with **Phase 1 only**, in plan mode. First steps within it: scaffold the
clean new repo, write `CLAUDE.md` with the seven cross-cutting principles, then
port the game loop and ETL from Leafs Legend and parameterize them off
`teams.ts`. Leave the live Leafs Legend v1 alone. Stop and check in before
Phase 2.
