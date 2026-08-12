# Data notes

## Sources & cutover
- **Hockey Databank CSVs** (github.com/rippinrobr/hockey-databank): Lahman-style
  files (`Master`, `Scoring`, `Goalies`, `Teams`, `abbrev`). NHL coverage
  1917–2017. `year` is the season start (2010 = 2010-11). Downloaded by
  `etl/fetch_databank.sh` into `etl/data/` (gitignored).
- **NHL API** (`api-web.nhle.com`, no key): current rosters/stats. Used for
  seasons ≥ 2011-12.
- **Cutover:** each season is owned by exactly one source — Databank for seasons
  ≤ 2010-11, NHL API for ≥ 2011-12 — so no season is counted twice. Per player we
  union both sides.
- **Cross-source join:** no shared id. Matched by normalized name (Pass 1 exact;
  Pass 2 last name + first initial), and for ambiguous cases confirmed by birth
  year via `/v1/player/{id}/landing`.

## Team identity — strict current identity
A player is credited for a team only if they played under its **current**
city/name. This drives `teams` and `teamGP` (the answer). It is implemented by
`canon(code)` in `etl/build_players.py`:

- Any code that is already one of the 32 current NHL codes → itself.
- Databank same-city spelling variants → the current code:
  `AND→ANA, CAL→CGY, CBS→CBJ, FLO→FLA, NAS→NSH, VEG→VGK, WAS→WSH`.
- **Everything else → not a current team** (excluded from `teams`/`teamGP`):
  relocations and renames-to-a-new-city and defunct clubs. Examples:
  - `ATL` Atlanta Thrashers (→ Winnipeg) — a Thrashers-only player is NOT a Jet.
  - `QUE` Quebec Nordiques (→ Colorado) — NOT an Avalanche.
  - `HAR`/`HFD` Hartford Whalers (→ Carolina) — NOT a Hurricane.
  - `ATF` Atlanta Flames, `MNS` Minnesota North Stars, `COR`/`CLR` Colorado
    Rockies, `KCS` Kansas City Scouts, `CLE` Cleveland Barons, `OAK`/`CGS`
    California Seals, plus 1920s–40s defunct clubs (Maroons, Wanderers,
    Americans, Pirates, Quakers, Eagles, Tigers, original Senators…).
  - `WIN` (original Jets), `PHO`/`PHX` (Phoenix), `ARI` (Arizona Coyotes) — the
    Coyotes lineage relocated to Utah, so none credit `UTA`. Utah Mammoth (`UTA`)
    is genuinely brand-new (2024), so its pool is legitimately thin.
  - Pre-current-name eras of Original-Six teams (Toronto Arenas/St. Pats
    `TOA`/`TRS`, Detroit Cougars/Falcons `DTC`/`DTF`) are also excluded — this
    keeps the Toronto page consistent with the live Leafs Legend v1 (TOR = 1927+).

Relocated/defunct appearances still count toward **`teamCount`** (well-travelled),
so those players remain eligible for the hardcore "No" pool.

### `teamCount` = distinct franchises, not raw codes
The same club appears under several codes: a stable team across the 2010→2011
cutover (Databank `CAL` + modern `CGY`), and the Coyotes under three
(`PHO`/`PHX`/`ARI`). `franchise_key()` collapses these so a Coyotes-only career
isn't counted as three teams. Genuine relocations to a new city stay distinct
(Thrashers vs Jets), matching how fans count. Effect verified: Keith Yandle
`teamCount` 6 → 4 (Coyotes + Panthers + Rangers + Flyers).

## Dataset fields
See CLAUDE.md for the entry shape. All counts are NHL regular-season games.
Pool filter: `careerGP ≥ 100`. `iconic` = Hall of Fame, or `careerPoints ≥ 1000`,
or `careerGP ≥ 1200`.

## Build & verification
```
bash etl/fetch_databank.sh
python3 etl/build_players.py --refresh   # or without --refresh to reuse the cache
```
The build prints spot-checks and refuses (non-zero exit) if the player count
collapses below `MIN_EXPECTED_PLAYERS` (4000) or an established team's pool is
empty — so a bad NHL pull never gets committed. Current build: 4566 players,
per-team pools 31 (UTA) … ~800, all spot-checks pass.
