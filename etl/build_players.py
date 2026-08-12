#!/usr/bin/env python3
"""
build_players.py — build web/public/players.json from the two sources,
generalized to all 32 NHL teams (ported from the Leafs-only v1).

Design (see ../CLAUDE.md and ../docs/data_notes.md):
  * Databank CSVs  -> seasons <= 2010-11   (offline, etl/data/*.csv)
  * NHL API        -> seasons >= 2011-12    (live, /v1/club-stats, cached)
  * A season is owned by exactly ONE source (cutover), so nothing is double
    counted. Per player we take the UNION of Databank(<=2010) + NHL(>=2011).
  * Same human across sources is linked by normalized name (only matters for
    players whose careers cross the 2011 cutover).

Team identity — STRICT CURRENT IDENTITY (see canon()):
  A player is credited for a team only if they suited up under that team's
  CURRENT city/name. Relocated/renamed/defunct clubs (Thrashers, Nordiques,
  Whalers, North Stars, original Jets/Coyotes -> Utah, ...) do NOT credit
  today's team. Those appearances still count toward `teamCount` (how
  well-travelled a player is, used by hardcore) but never toward `teams`.

Everything is regular-season games. Output entry:
  { id, name, position, teams[], teamGP{}, decadesActive[], teamDecades{},
    careerGP, teamCount, iconic }

Run:
  python3 etl/build_players.py            # uses cached modern data if present
  python3 etl/build_players.py --refresh  # re-fetch the NHL modern side
Stdlib only.
"""

import csv
import json
import os
import sys
import time
import unicodedata
import urllib.error
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(HERE, "data")
OUT_PATH = os.path.join(HERE, "..", "web", "public", "players.json")
MODERN_CACHE = os.path.join(DATA_DIR, "modern_cache.json")

API = "https://api-web.nhle.com"
STATS = "https://api.nhle.com/stats/rest/en"

CUTOVER_LAST_DB_YEAR = 2010      # 2010 == 2010-11; >= 2011 comes from the NHL API
FIRST_MODERN_SEASON = 20112012
POOL_MIN_GP = 100                # "recognizable" filter
MIN_EXPECTED_PLAYERS = 4000      # sanity floor for the automated pipeline
SYNTH_ID_BASE = 700_000_000      # ids for Databank-only players

# iconic = HOF or clearly elite production (keeps obvious legends out of hardcore)
ICONIC_MIN_POINTS = 1000
ICONIC_MIN_GP = 1200

# --------------------------------------------------------------------------- #
# Team identity (strict current identity)
# --------------------------------------------------------------------------- #
# The 32 current NHL team codes (NHL API tricodes == keys in web/app/lib/teams.ts).
CURRENT_CODES = {
    "ANA", "BOS", "BUF", "CAR", "CBJ", "CGY", "CHI", "COL", "DAL", "DET",
    "EDM", "FLA", "LAK", "MIN", "MTL", "NJD", "NSH", "NYI", "NYR", "OTT",
    "PHI", "PIT", "SEA", "SJS", "STL", "TBL", "TOR", "UTA", "VAN", "VGK",
    "WPG", "WSH",
}

# Databank uses its own abbreviations. These are the same continuous franchise
# under its current identity, just spelled differently -> fold them to the
# current code. Every OTHER historical code (relocations / renames to a new
# city / defunct clubs, incl. the modern ARI/PHX which relocated to Utah) is not
# in CURRENT_CODES and therefore resolves to None automatically.
CANON = {
    "AND": "ANA",  # Anaheim Ducks (Databank's post-2006-rebrand code)
    "CAL": "CGY",  # Calgary Flames
    "CBS": "CBJ",  # Columbus Blue Jackets
    "FLO": "FLA",  # Florida Panthers
    "NAS": "NSH",  # Nashville Predators
    "VEG": "VGK",  # Vegas Golden Knights
    "WAS": "WSH",  # Washington Capitals
}


def canon(code):
    """Map any source team code to a current-32 code, or None if the club is a
    relocation / rename-to-a-new-city / defunct franchise (not a playable team)."""
    if code in CURRENT_CODES:
        return code
    return CANON.get(code)  # None for everything historical


# `teamCount` = how well-travelled a player is (drives hardcore). It must count
# distinct FRANCHISES, not raw spellings: the same club shows up under multiple
# codes — a stable team across the 2010->2011 cutover (Databank CAL + modern CGY)
# and the Coyotes under three (Databank PHO, modern PHX, then ARI). Collapse
# those so a Coyotes-only career isn't counted as three teams. Genuine
# relocations to a new city (Thrashers vs Jets, Whalers vs Hurricanes) stay
# distinct — fans count those separately.
RELOC = {"PHO": "PHX", "ARI": "PHX", "WIN": "PHX"}  # Jets/Coyotes/Arizona lineage


def franchise_key(code):
    """A stable key per franchise for counting distinct clubs."""
    c = canon(code)
    if c:
        return c                       # current teams (folds cutover spelling dups)
    return RELOC.get(code, code)       # historical: keep distinct unless a known dup


# --------------------------------------------------------------------------- #
# helpers
# --------------------------------------------------------------------------- #
def norm_name(s):
    s = unicodedata.normalize("NFKD", s or "")
    s = "".join(c for c in s if not unicodedata.combining(c))
    return "".join(c for c in s.lower() if c.isalnum() or c == " ").strip()


def norm_pos(p):
    p = (p or "").upper()
    if "G" in p:
        return "G"
    if p.startswith("D"):
        return "D"
    if p.startswith("L"):
        return "L"
    if p.startswith("R"):
        return "R"
    if p.startswith("C"):
        return "C"
    return p[:1] or "?"


def decade_label(start_year):
    return f"{(start_year // 10) * 10}s"


def decades_of(years):
    return sorted({decade_label(y) for y in years}, key=lambda d: int(d[:-1]))


def fetch_json(url, retries=3):
    req = urllib.request.Request(url, headers={"User-Agent": "rink-streak-etl/0.1"})
    for attempt in range(retries):
        try:
            with urllib.request.urlopen(req, timeout=25) as resp:
                return json.load(resp)
        except urllib.error.HTTPError as e:
            if e.code == 404:
                return None
            if attempt == retries - 1:
                raise
        except urllib.error.URLError:
            if attempt == retries - 1:
                raise
        time.sleep(1.0 + attempt)
    return None


def load_csv(name):
    with open(os.path.join(DATA_DIR, name), newline="", encoding="latin-1") as fh:
        return list(csv.DictReader(fh))


def new_agg(name="", pos=""):
    return {"name": name, "pos": pos, "seasons": set(), "clubs": set(),
            "teamGP": {}, "teamSeasons": {}, "gp": 0, "points": 0, "hof": False}


def record(a, raw_code, year, gp):
    """Add one team-season appearance to an aggregate."""
    a["seasons"].add(year)
    a["clubs"].add(raw_code)   # raw code -> feeds teamCount (well-travelled)
    a["gp"] += gp
    c = canon(raw_code)
    if c and gp > 0:           # credited to a current team only if actually played
        a["teamGP"][c] = a["teamGP"].get(c, 0) + gp
        a["teamSeasons"].setdefault(c, set()).add(year)


# --------------------------------------------------------------------------- #
# Databank side (seasons <= 2010-11)
# --------------------------------------------------------------------------- #
def build_databank():
    master = {r["playerID"]: r for r in load_csv("Master.csv") if r["playerID"]}
    aggs = {}  # databank playerID -> agg

    def touch(pid):
        if pid not in aggs:
            m = master.get(pid, {})
            name = f"{m.get('firstName','').strip()} {m.get('lastName','').strip()}".strip()
            a = new_agg(name, norm_pos(m.get("pos")))
            a["hof"] = bool((m.get("hofID") or "").strip())
            a["by"] = int(m["birthYear"]) if (m.get("birthYear") or "").isdigit() else None
            aggs[pid] = a
        return aggs[pid]

    # Goalies appear in BOTH Scoring.csv and Goalies.csv with identical GP, so
    # dedupe each appearance by (playerID, year, stint, tmID) to avoid counting
    # a goalie's games twice. Scoring is processed first (it has everyone).
    seen = set()

    def ingest(rows, has_points):
        for r in rows:
            if r["lgID"] != "NHL" or not r["year"]:
                continue
            year = int(r["year"])
            if year > CUTOVER_LAST_DB_YEAR:
                continue  # cutover: >= 2011 owned by the NHL API
            key = (r["playerID"], year, r.get("stint"), r["tmID"])
            if key in seen:
                continue
            seen.add(key)
            gp = int(r.get("GP") or 0)
            a = touch(r["playerID"])
            record(a, r["tmID"], year, gp)
            if has_points:
                a["points"] += int(r.get("Pts") or 0)

    ingest(load_csv("Scoring.csv"), has_points=True)
    ingest(load_csv("Goalies.csv"), has_points=False)

    # lastNHL gates cross-source matching (only careers touching the cutover).
    last_nhl = {pid: int(m["lastNHL"]) for pid, m in master.items() if (m.get("lastNHL") or "").isdigit()}
    return aggs, last_nhl


# --------------------------------------------------------------------------- #
# NHL modern side (seasons >= 2011-12) via club-stats
# --------------------------------------------------------------------------- #
def fetch_modern():
    teams = fetch_json(f"{STATS}/team")["data"]
    tricodes = sorted({t["triCode"] for t in teams if t.get("triCode")})

    modern = {}  # nhl playerId (str) -> agg
    n_calls = 0
    for i, tri in enumerate(tricodes, 1):
        seasons_info = fetch_json(f"{API}/v1/club-stats-season/{tri}")
        n_calls += 1
        if not isinstance(seasons_info, list):
            continue
        seasons = [s["season"] for s in seasons_info
                   if s.get("season", 0) >= FIRST_MODERN_SEASON and 2 in s.get("gameTypes", [])]
        for season in seasons:
            data = fetch_json(f"{API}/v1/club-stats/{tri}/{season}/2")
            n_calls += 1
            if not data:
                continue
            start_year = season // 10000
            for grp in ("skaters", "goalies"):
                for p in data.get(grp, []):
                    pid = str(p["playerId"])
                    name = f"{p.get('firstName',{}).get('default','')} {p.get('lastName',{}).get('default','')}".strip()
                    # club-stats goalies carry no positionCode -> set it here.
                    pos = "G" if grp == "goalies" else norm_pos(p.get("positionCode"))
                    a = modern.setdefault(pid, new_agg(name, pos))
                    if not a["name"]:
                        a["name"] = name
                    if a["pos"] in ("", "?"):
                        a["pos"] = pos
                    gp = int(p.get("gamesPlayed") or 0)
                    record(a, tri, start_year, gp)
                    a["points"] += int(p.get("points") or 0)
        print(f"  [{i:>2}/{len(tricodes)}] {tri}: {len(seasons)} modern seasons "
              f"(players so far: {len(modern)})", flush=True)
    print(f"  modern fetch done: {len(modern)} players, {n_calls} API calls")
    return modern


def _ser_agg(a):
    return {**a, "seasons": sorted(a["seasons"]), "clubs": sorted(a["clubs"]),
            "teamGP": a["teamGP"],
            "teamSeasons": {c: sorted(s) for c, s in a["teamSeasons"].items()}}


def _deser_agg(a):
    a["seasons"] = set(a["seasons"])
    a["clubs"] = set(a["clubs"])
    a["teamSeasons"] = {c: set(s) for c, s in a["teamSeasons"].items()}
    return a


def save_modern(modern):
    with open(MODERN_CACHE, "w") as f:
        json.dump({pid: _ser_agg(a) for pid, a in modern.items()}, f)


def load_modern_cache():
    with open(MODERN_CACHE) as f:
        ser = json.load(f)
    for a in ser.values():
        _deser_agg(a)
    return ser


# --------------------------------------------------------------------------- #
# Merge + derive
# --------------------------------------------------------------------------- #
def merge_agg(dst, src):
    dst["seasons"] |= src["seasons"]
    dst["clubs"] |= src["clubs"]
    dst["gp"] += src["gp"]
    dst["points"] += src["points"]
    dst["hof"] = dst["hof"] or src["hof"]
    for c, v in src["teamGP"].items():
        dst["teamGP"][c] = dst["teamGP"].get(c, 0) + v
    for c, ss in src["teamSeasons"].items():
        dst["teamSeasons"].setdefault(c, set()).update(ss)


def build():
    print("Databank (<=2010-11) ...")
    db_aggs, db_last = build_databank()
    print(f"  {len(db_aggs)} Databank players with NHL seasons <= {CUTOVER_LAST_DB_YEAR}")

    if "--refresh" in sys.argv or not os.path.exists(MODERN_CACHE):
        print("NHL modern (>=2011-12) ... fetching (cache miss or --refresh)")
        modern = fetch_modern()
        save_modern(modern)
    else:
        print("NHL modern (>=2011-12) ... loading cache "
              "(use --refresh to re-fetch)")
        modern = load_modern_cache()
    print(f"  {len(modern)} modern players")

    # A genuine cutover-spanning player has NHL seasons on both sides, so their
    # Databank Master.lastNHL is >= 2011. That gates cross-source matching:
    # a Databank career ending <= 2010-11 has no modern counterpart.
    modern_start_year = FIRST_MODERN_SEASON // 10000  # 2011

    birth_cache = {}

    def modern_birthyear(nhl_id):
        if nhl_id not in birth_cache:
            d = fetch_json(f"{API}/v1/player/{nhl_id}/landing") or {}
            bd = str(d.get("birthDate", ""))
            birth_cache[nhl_id] = int(bd[:4]) if bd[:4].isdigit() else None
        return birth_cache[nhl_id]

    people = {}            # output id -> agg (modern NHL ids first)
    consumed_db = set()
    merged_modern = set()

    # ---- Pass 1: exact normalized full-name match ----
    db_by_name = {}
    for dpid, a in db_aggs.items():
        db_by_name.setdefault(norm_name(a["name"]), []).append(dpid)

    for pid, a in modern.items():
        agg = new_agg(a["name"], a["pos"])
        merge_agg(agg, a)
        cands = [c for c in db_by_name.get(norm_name(a["name"]), [])
                 if db_last.get(c, 0) >= modern_start_year and c not in consumed_db]
        if cands:
            same_pos = [c for c in cands if db_aggs[c]["pos"] == a["pos"]]
            c = (same_pos or cands)[0]
            merge_agg(agg, db_aggs[c])
            consumed_db.add(c)
            merged_modern.add(int(pid))
        people[int(pid)] = agg

    # ---- Pass 2: spanning Databank players whose name did NOT match exactly
    # (nickname / transliteration, e.g. "Alex Steen" vs "Alexander Steen").
    # Match by last name + first initial, confirmed by birth year. ----
    modern_index = {}
    for pid, agg in people.items():
        parts = norm_name(agg["name"]).split()
        if parts:
            modern_index.setdefault(parts[-1], []).append(pid)

    ambiguous = 0
    for dpid in sorted(db_aggs):
        if dpid in consumed_db:
            continue
        a = db_aggs[dpid]
        if not a["seasons"] or db_last.get(dpid, 0) < modern_start_year:
            continue
        parts = norm_name(a["name"]).split()
        if not parts:
            continue
        fi = parts[0][:1]
        cands = [pid for pid in modern_index.get(parts[-1], [])
                 if pid not in merged_modern
                 and norm_name(people[pid]["name"]).split()[0][:1] == fi]
        if len(cands) > 1 and a.get("by"):
            cands = [pid for pid in cands if modern_birthyear(pid) == a["by"]] or cands
        if len(cands) == 1:
            pid = cands[0]
            if a.get("by") and modern_birthyear(pid) not in (None, a["by"]):
                ambiguous += 1          # birth year contradicts — refuse the merge
                continue
            merge_agg(people[pid], a)
            consumed_db.add(dpid)
            merged_modern.add(pid)
        elif len(cands) > 1:
            ambiguous += 1

    # ---- Databank-only players: purely historical careers (last NHL <= 2010-11).
    # Spanning players still unmatched here already exist on the modern side, so
    # we skip them rather than emit a duplicate. ----
    synth = SYNTH_ID_BASE
    missed_modern = 0
    for dpid in sorted(db_aggs):
        if dpid in consumed_db or not db_aggs[dpid]["seasons"]:
            continue
        if db_last.get(dpid, 0) >= modern_start_year:
            missed_modern += 1
            continue
        agg = new_agg(db_aggs[dpid]["name"], db_aggs[dpid]["pos"])
        merge_agg(agg, db_aggs[dpid])
        people[synth] = agg
        synth += 1

    # "active" = played in the dataset's most recent season. Used by casual mode,
    # where current players are always eligible even below the games threshold.
    latest_season = max((max(a["seasons"]) for a in people.values() if a["seasons"]),
                        default=0)
    print(f"  latest season in data: {latest_season}-{latest_season + 1}")

    # Derive output entries + pool filter.
    entries = []
    for pid, a in people.items():
        if a["gp"] < POOL_MIN_GP:
            continue
        iconic = a["hof"] or a["points"] >= ICONIC_MIN_POINTS or a["gp"] >= ICONIC_MIN_GP
        teams = sorted(a["teamGP"].keys())
        entries.append({
            "id": pid,
            "name": a["name"],
            "position": a["pos"],
            "teams": teams,
            "teamGP": {c: a["teamGP"][c] for c in teams},
            "decadesActive": decades_of(a["seasons"]),
            "teamDecades": {c: decades_of(a["teamSeasons"].get(c, set())) for c in teams},
            "careerGP": a["gp"],
            "teamCount": len({franchise_key(c) for c in a["clubs"]}),
            "iconic": iconic,
            "active": bool(a["seasons"]) and max(a["seasons"]) == latest_season,
        })
    entries.sort(key=lambda e: (-e["careerGP"], e["name"]))

    os.makedirs(os.path.dirname(OUT_PATH), exist_ok=True)
    with open(OUT_PATH, "w") as f:
        json.dump(entries, f, ensure_ascii=False, indent=1)

    return report(entries, ambiguous, missed_modern)


# --------------------------------------------------------------------------- #
# report + verification
# --------------------------------------------------------------------------- #
def report(entries, ambiguous, missed_modern):
    by_name = {norm_name(e["name"]): e for e in entries}
    print("\n" + "=" * 70)
    print(f"players.json written: {len(entries)} entries -> {os.path.relpath(OUT_PATH, HERE)}")
    print(f"  iconic: {sum(e['iconic'] for e in entries)}")
    print(f"  name-match ambiguities: {ambiguous}  | Databank careers reaching "
          f">=2011 with no modern match: {missed_modern}")

    # Per-team pool sizes (sanity: every current team should have a pool).
    counts = {c: 0 for c in sorted(CURRENT_CODES)}
    for e in entries:
        for c in e["teams"]:
            counts[c] = counts.get(c, 0) + 1
    empty = [c for c, n in counts.items() if n == 0]
    thin = sorted((n, c) for c, n in counts.items() if 0 < n < 40)
    print(f"  per-team pools: min={min(counts.values())} max={max(counts.values())}")
    if empty:
        print(f"  EMPTY team pools: {empty}")
    if thin:
        print(f"  thin (<40) pools: {[f'{c}={n}' for n, c in thin]}")

    print("\nMANDATED SPOT-CHECKS (did-they-play-for-team-X, strict identity):")
    # (name, teamCode, expect membership)
    checks = [
        ("Mats Sundin", "TOR", True), ("Auston Matthews", "TOR", True),
        ("Connor McDavid", "EDM", True), ("Connor McDavid", "TOR", False),
        ("Sidney Crosby", "PIT", True), ("Sidney Crosby", "MTL", False),
        ("Phil Kessel", "TOR", True), ("Phil Kessel", "BOS", True),
        ("Phil Kessel", "PIT", True), ("Phil Kessel", "VGK", True),
        ("Ilya Kovalchuk", "NJD", True), ("Ilya Kovalchuk", "WPG", False),
        ("Joe Sakic", "COL", True), ("Joe Sakic", "MTL", False),
    ]
    ok = True
    for name, code, want in checks:
        e = by_name.get(norm_name(name))
        got = (code in e["teams"]) if e else None
        flag = "PASS" if (e and got == want) else "FAIL"
        ok = ok and flag == "PASS"
        print(f"  [{flag}] {name:16s} {code}={str(got):<5} (want {want})")
    print("  =>", "ALL SPOT-CHECKS PASS" if ok else "*** SPOT-CHECK FAILURE ***")

    print("\nRELOCATION / STRICT-IDENTITY EYEBALL (teams shown vs teamCount):")
    for name in ["Phil Kessel", "Ilya Kovalchuk", "Joe Sakic", "Keith Yandle",
                 "Marian Hossa", "Dany Heatley"]:
        e = by_name.get(norm_name(name))
        if e:
            print(f"  {name:16s} teams={e['teams']} teamCount={e['teamCount']} "
                  f"careerGP={e['careerGP']}")

    print("\nHARDCORE POOL PREVIEW (per active team, example TOR):")
    tor_yes = [e for e in entries if e["teamGP"].get("TOR", 0) and e["teamGP"]["TOR"] < 82]
    hc_no = [e for e in entries if "TOR" not in e["teams"] and e["teamCount"] > 3 and not e["iconic"]]
    print(f"  hardcore YES (played TOR, <82 games there): {len(tor_yes)}")
    for e in sorted(tor_yes, key=lambda e: e["teamGP"]["TOR"])[:4]:
        print(f"    {e['name']} (TOR GP={e['teamGP']['TOR']})")
    print(f"  hardcore NO for TOR (never TOR, >3 clubs, not iconic): {len(hc_no)}")

    # Guard the automated pipeline: a partial NHL fetch collapses the count.
    if len(entries) < MIN_EXPECTED_PLAYERS:
        print(f"\n*** TOO FEW PLAYERS ({len(entries)} < {MIN_EXPECTED_PLAYERS}) "
              "— likely a bad data pull; refusing.")
        ok = False
    if empty:
        print(f"\n*** EMPTY TEAM POOLS {empty} — refusing (Utah/expansion may be "
              "legitimately thin, but not zero for established teams).")
        # Utah (UTA) is genuinely brand-new; allow it to be thin but not the rest.
        if empty != ["UTA"]:
            ok = False
    return ok


if __name__ == "__main__":
    raise SystemExit(0 if build() else 1)
