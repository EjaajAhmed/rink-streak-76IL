# Rink Streak (working name)

A browser game for all 32 NHL teams. Pick a team, get shown NHL players one at a
time, and guess whether each one *ever* played a game for that team. Correct
guesses extend a streak; one wrong answer ends the run. Each team has its own
themed page at `/[team-slug]`.

New project ported from the single-team **Leafs Legend** (which stays live and
untouched). See [CLAUDE.md](./CLAUDE.md) for scope, principles, and data rules,
and `BUILD_PLAN.md` for the phased roadmap. **This is Phase 1** (scaffold + port
+ parameterize); accounts, leaderboards, custom domain, monetization, and 1v1
are later phases — check in before starting each.

## Layout
```
/etl    Python — builds web/public/players.json from two sources
/web    Next.js app (App Router); per-team static pages
/docs   data-schema, cutover + relocation decisions
```

## Data
- **NHL API** (`api-web.nhle.com`, no key) — recent seasons (≥ 2011-12).
- **Hockey Databank CSVs** — deep history (used for seasons ≤ 2010-11).

Combined offline by a season cutover into a static `players.json`; the game never
calls an API at runtime. Team identity is **strict current identity** — relocated
franchises don't credit today's team (see `docs/data_notes.md`).

## ETL
Stdlib only — no install step.
```
bash etl/fetch_databank.sh          # download the Databank CSVs -> etl/data/
python3 etl/build_players.py        # -> web/public/players.json (reuses NHL cache)
python3 etl/build_players.py --refresh   # re-pull the NHL modern side
```
The build prints mandated spot-checks and exits non-zero on failure (collapsed
count or an empty established-team pool), so a bad pull is never committed.

### Monthly auto-update
`.github/workflows/update-data.yml` re-runs the ETL on the 1st of each month
(and on manual dispatch), commits `players.json` if it changed, and pushes —
which triggers a Vercel redeploy.

## Web
```
cd web && npm install
npm run dev     # http://localhost:3000  (landing grid → /maple-leafs, /bruins, …)
npm run build
```
Deploy on Vercel with **Root Directory = `web`**.
