# CLAUDE.md — Multi-team NHL streak game

## What this is
A browser game covering all 32 NHL teams. Each team has its own page
(`/[team-slug]`). On a team's page the user is shown NHL players one at a time
and guesses whether that player **ever** played a game for **that team**. Correct
guesses extend a streak; one wrong answer ends the run. An era selector controls
which decades of players appear. Inspired by 82-0.com; a simple binary yes/no
streak (closer in mechanic to Immaculate Grid).

This is a **new project**, ported from the single-team "Leafs Legend" (which
stays live and untouched as its own repo — do not modify it here).

Fan project — do NOT use official NHL/team logos or wordmarks. Team names as
plain text are fine.

## Cross-cutting principles (apply to every phase — from BUILD_PLAN.md)
1. **Guest-first.** The full game works with no login. Accounts (Phase 2) only
   *add* persistence; they never gate play.
2. **Site name is one config constant.** `SITE_NAME` in `web/app/lib/config.ts`,
   referenced everywhere. The public brand is still TBD — never hardcode a name.
3. **One shared answer-check module.** `playedForTeam(player, teamCode)` in
   `web/app/lib/players.ts` is the ONLY place "did they play for X?" is decided.
   This is what lets it move server-side later (cheat-proof leaderboards, 1v1).
   Never scatter answer logic across components.
4. **Player selection is seed-driven.** A run's sequence comes from a seeded RNG
   (`web/app/lib/rng.ts` → `web/app/lib/sequence.ts`), not per-pick
   `Math.random()`. Enables replay/verification, daily challenges, and identical
   1v1 sequences later.
5. **Per-team routes** (`/[team-slug]`) for SEO/shareability — each team its own
   indexable page, themed via `themeVars()` / CSS variables.
6. **Ship phase by phase.** Each phase ends deployed and testable.
7. **Do not touch Leafs Legend v1.**

Phase status: **Phases 1–2 built.** Phase 1 = scaffold + port + parameterize.
Phase 2 = optional accounts + personal stats (Supabase, Google + magic-link),
non-intrusive and **dormant until Supabase env vars are set** — see below.
Phases 3–6 (leaderboards, custom domain/SEO + Leafs Legend cutover, monetization,
1v1) are NOT built yet — see BUILD_PLAN.md and check in before starting each.

### Phase 2 — accounts + stats (Supabase)
- Optional sign-in only; **guest play is never gated** (principle 1). With no
  `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`, the whole layer is
  inert and the app is byte-for-byte the Phase 1 guest build. The guard is
  `isSupabaseConfigured()` in `web/app/lib/supabase/config.ts`.
- Auth: Google OAuth + passwordless magic link, via `@supabase/ssr`
  (`web/app/lib/supabase/{client,server}.ts`, `web/middleware.ts`,
  `web/app/auth/callback/route.ts`, context in `web/app/lib/auth.tsx`).
- Persistence: `web/app/lib/stats.ts`. On run end, signed-in players log a `runs`
  row + upsert `best_streaks`; guests keep localStorage. First sign-in offers to
  import local bests. Profile page at `web/app/me/`.
- Schema + RLS: `supabase/schema.sql` (owner-only). Setup: `docs/supabase_setup.md`.
- Stats are **client-reported** (fine for personal). Public/competitive
  leaderboards + server-authoritative validation are Phase 3 — do NOT make these
  tables public-readable before then.

## Stack
- Web: Next.js (App Router) + React + TypeScript + Tailwind. Static / client-side.
  Per-team pages are statically generated (`generateStaticParams`). Deploy on
  Vercel with Root Directory = `web`.
- ETL: Python, stdlib only. One-time scripts that build the dataset — not part of
  the runtime. The game NEVER calls a live API at runtime.
- Live streak in React state; best streak in localStorage (key
  `rinkstreak.best.<team>.<mode>.<era>`).
- No FastAPI / Supabase yet. Added in Phase 2 for optional accounts, and only
  goes server-authoritative when competitive leaderboards / 1v1 need it.

## Data — read before touching anything data-related
The game ships a pre-built static dataset at `web/public/players.json` and never
calls a live API at runtime. All data work happens offline in the ETL.

Two sources, combined offline:
- **NHL API** (`https://api-web.nhle.com`, no key) — source of truth for recent
  seasons. Endpoints: `/v1/club-stats-season/{TEAM}`, `/v1/club-stats/{TEAM}/{SEASON}/2`,
  `/v1/player/{id}/landing` (birth date, for cross-source confirmation).
- **Hockey Databank CSVs** (github.com/rippinrobr/hockey-databank) — deep history.
  Runs through 2017-18, but per the cutover we only USE it for seasons ≤ 2010-11.

Critical rule: each SEASON is owned by exactly one source (cutover: Databank ≤
2010-11, NHL API ≥ 2011-12), so nothing is double-counted. Per player we take the
UNION of both sides. Same human across sources is linked by name (exact, then
last-name + first-initial confirmed by birth year).

### Team identity — strict current identity
A player is credited for a team (`teams` / `teamGP`) only if they suited up under
that team's **current** city/name. Relocated/renamed/defunct clubs do NOT credit
today's team: Atlanta Thrashers ≠ Winnipeg Jets, Quebec Nordiques ≠ Colorado
Avalanche, Hartford Whalers ≠ Carolina Hurricanes, Minnesota North Stars ≠ Dallas
Stars, original Jets / Phoenix / Arizona Coyotes ≠ Utah Mammoth. Those
appearances still count toward `teamCount` (how well-travelled a player is, used
by hardcore) but never toward the playable team set. See `etl/build_players.py`
(`canon()` + `CANON`) and `docs/data_notes.md`.

Databank uses its own abbreviations; `canon()` folds the same-city spelling
variants to the current NHL code (CAL→CGY, CBS→CBJ, FLO→FLA, NAS→NSH, VEG→VGK,
WAS→WSH, AND→ANA). Everything else historical isn't a current code, so it
resolves to "not a current team."

### Dataset entry shape
```json
{
  "id": 8478483,
  "name": "Example Player",
  "position": "C",
  "teams": ["TOR", "BOS"],
  "teamGP": { "TOR": 400, "BOS": 82 },
  "decadesActive": ["2010s", "2020s"],
  "teamDecades": { "TOR": ["2010s"], "BOS": ["2020s"] },
  "careerGP": 800,
  "teamCount": 3,
  "iconic": false,
  "active": false
}
```
Field notes (all counts are NHL regular-season games; playoff-only stints not
counted — negligible):
- `teams` — current-identity team codes the player actually played a game for.
- `teamGP` — regular-season games per team (keys ⊆ `teams`). Answer/difficulty
  read from here.
- `decadesActive` / `teamDecades` — decades overall / per team (keeps a
  "played for team X *in* decade Y" mode possible later).
- `careerGP` — total NHL regular-season games (also the ≥100 pool filter).
- `teamCount` — distinct franchises incl. relocated/defunct (spelling dups
  collapsed via `franchise_key`). Used to keep obvious legends / one-club players
  out of the hardcore "No" pool.
- `iconic` — instantly recognizable (Hall of Fame, or ≥1000 pts / ≥1200 GP).
- `active` — played in the dataset's most recent season (used by casual mode so
  current players stay eligible even below the games threshold).

Player pool: recognizable players (`careerGP` ≥ ~100); casual mode tightens this
further (below).

Verify the data — it IS the game. After any build, the ETL prints spot-checks:
Sundin/Matthews→TOR true; McDavid→EDM true, TOR false; Kessel→TOR/BOS/PIT/VGK
true (ARI excluded, strict); Kovalchuk→NJD true, WPG false; Sakic→COL only.

## Difficulty modes (per active team)
The pool depends on a mode; both modes respect the era selector.

Era rule (both modes): when a specific decade is selected, a player who played
for the team is only shown if they played for it *in that decade*
(`teamDecades[team]` overlaps the selection); a player who never played for the
team just needs to be active in that decade. This avoids the confusing case of a
YES player who wore the sweater in a different decade than the one selected.
"All eras" applies no decade filter.

- **Casual** — popular players only: `careerGP` ≥ 500 **or** `active`
  (`CASUAL_MIN_GP` in `lib/config.ts`). Current players count regardless of
  games since they're recognizable now.
- **Hardcore** — strip the gimmes for the ACTIVE team:
  - YES (played this team): eligible only if `teamGP[team]` < 82 (a "cup of
    coffee" — under ~one full season there).
  - NO (never this team): eligible only if `teamCount` > 3 **and** not `iconic`
    (well-travelled journeymen you can't rule out at a glance).

Thresholds (`HARDCORE_TEAM_MAX_GP=82`, `HARDCORE_MIN_TEAMS=3`) and the answer
bias (`TEAM_APPEARANCE_RATE=0.4`, biases selection toward the active team so
"No" can't be a coin-flip default) are client-side knobs in `lib/config.ts` —
tune without rebuilding.

## Structure
```
/etl                        Python — builds players.json from the two sources
/web                        Next.js app
/web/app/page.tsx           landing: 32-team grid
/web/app/[team]/            per-team route (page.tsx = SSR shell, Game.tsx = client game)
/web/app/lib/               config, teams, rng, sequence, players (pure logic)
/web/public/players.json    generated dataset (committed)
/docs                       data schema, cutover + relocation decisions
/.github/workflows          monthly dataset auto-refresh
```

## Commands
- ETL build: `python3 etl/build_players.py` (add `--refresh` to re-pull the NHL
  modern side; otherwise it reuses `etl/data/modern_cache.json`). Needs the
  Databank CSVs first: `bash etl/fetch_databank.sh`. Stdlib only, no venv.
- Web dev: `cd web && npm run dev`
- Web build: `cd web && npm run build`

## Working style
- Provide complete, copy-pasteable files, not partial diffs.
- Terminal commands without inline comments.
- Confirm a fix works before writing docs about it.
- Build data-first: validate the dataset before building game UI on top of it.
