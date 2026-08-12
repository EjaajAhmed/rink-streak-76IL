// Types + pure game logic. No React here so it is easy to reason about / test.
// Shape mirrors web/public/players.json (built by etl/build_players.py).

import {
  CASUAL_MIN_GP,
  HARDCORE_TEAM_MAX_GP,
  HARDCORE_MIN_TEAMS,
} from "./config";

export type Player = {
  id: number;
  name: string;
  position: string;
  teams: string[]; // current-identity team codes the player actually played for
  teamGP: Record<string, number>; // per-team regular-season games (keys ⊆ teams)
  decadesActive: string[];
  teamDecades: Record<string, string[]>;
  careerGP: number;
  teamCount: number; // distinct clubs incl. relocated/defunct (well-travelled metric)
  iconic: boolean;
  active: boolean; // played in the dataset's most recent season
};

export type Mode = "casual" | "hardcore";

// An era = a selectable pool filter. `decades: null` means "no filter" (all).
export type Era = {
  id: string;
  label: string;
  decades: string[] | null;
};

// Pre-expansion decades (Original Six era) are sparse — collapse everything
// before 1970 into one neutral bucket instead of a pill per decade. 1970s
// onward stay as individual decades. (Generalised from v1's Leafs "Cups Era".)
export const PRE_EXPANSION_BEFORE = 1970;

/* ------------------------------------------------------------ answer check */
// THE single source of truth for "did this player play for team X?" (BUILD_PLAN
// principle 3). Every part of the app — UI, scoring, and any future server-side
// validation — must go through here, never re-derive it from raw fields.
export function playedForTeam(p: Player, teamCode: string): boolean {
  return p.teams.includes(teamCode);
}

/** Whether a yes/no guess is correct for this player + active team. */
export function isCorrect(p: Player, teamCode: string, guess: boolean): boolean {
  return guess === playedForTeam(p, teamCode);
}

/* -------------------------------------------------------------- difficulty */
/**
 * Hardcore strips the gimmes on both sides, relative to the ACTIVE team:
 *  - YES players (played for this team): only forgettable stints
 *    (games for this team < HARDCORE_TEAM_MAX_GP ≈ one season).
 *  - NO players (never this team): well-travelled journeymen (> HARDCORE_MIN_TEAMS
 *    clubs) who aren't instantly recognizable (not iconic).
 */
export function isHardcoreEligible(p: Player, teamCode: string): boolean {
  if (playedForTeam(p, teamCode)) {
    return (p.teamGP[teamCode] ?? 0) < HARDCORE_TEAM_MAX_GP;
  }
  return p.teamCount > HARDCORE_MIN_TEAMS && !p.iconic;
}

/** Casual = popular players only: a real career (>= CASUAL_MIN_GP games) or a
 *  currently active player (recognizable now, even below the threshold). */
export function isCasualEligible(p: Player): boolean {
  return p.careerGP >= CASUAL_MIN_GP || p.active;
}

export function buildPool(
  players: Player[],
  teamCode: string,
  mode: Mode,
  decades: string[] | null,
): Player[] {
  return players.filter((p) => {
    // Era filter. When a decade is selected we require the *right* kind of
    // in-decade involvement, so there are no confusing entries:
    //  - a player who played for this team must have played for it IN the
    //    selected decade (not just been active elsewhere then);
    //  - a player who never played for this team must merely be active in it.
    if (decades) {
      if (playedForTeam(p, teamCode)) {
        const td = p.teamDecades[teamCode] ?? [];
        if (!td.some((d) => decades.includes(d))) return false;
      } else if (!p.decadesActive.some((d) => decades.includes(d))) {
        return false;
      }
    }

    if (mode === "hardcore") {
      if (!isHardcoreEligible(p, teamCode)) return false;
    } else if (!isCasualEligible(p)) {
      return false;
    }
    return true;
  });
}

/* -------------------------------------------------------------------- eras */
export function decadeList(players: Player[]): string[] {
  const seen = new Set<string>();
  for (const p of players) for (const d of p.decadesActive) seen.add(d);
  return [...seen].sort((a, b) => parseInt(a, 10) - parseInt(b, 10));
}

/** Decades in which the TEAM itself existed — i.e. decades any player played
 *  *for* this team. This is what an expansion team's era pills come from, so
 *  Vegas (2010s+) never offers a "1980s" filter it was never around for. */
export function teamDecadeList(players: Player[], teamCode: string): string[] {
  const seen = new Set<string>();
  for (const p of players) {
    for (const d of p.teamDecades[teamCode] ?? []) seen.add(d);
  }
  return [...seen].sort((a, b) => parseInt(a, 10) - parseInt(b, 10));
}

/**
 * Era pills for a team, limited to decades it actually existed for.
 *  - Original Six (genuine pre-expansion history, i.e. any decade before the
 *    1960s) get a single "Pre-1970" bucket for their sparse early decades.
 *  - 1967-expansion teams (earliest decade is the 1960s — just the 1967-68 and
 *    1968-69 seasons) don't get a lonely pre-1970 bucket; those two seasons fold
 *    into the "1970s" pill instead.
 *  - Later teams just get a pill per decade.
 */
export function buildEras(players: Player[], teamCode: string): Era[] {
  const decades = teamDecadeList(players, teamCode); // ascending
  const year = (d: string) => parseInt(d, 10);
  const eras: Era[] = [{ id: "all", label: "All eras", decades: null }];

  if (decades.some((d) => year(d) < 1960)) {
    const pre = decades.filter((d) => year(d) < PRE_EXPANSION_BEFORE);
    eras.push({ id: "pre1970", label: "Pre-1970", decades: pre });
    for (const d of decades) if (year(d) >= PRE_EXPANSION_BEFORE) {
      eras.push({ id: d, label: d, decades: [d] });
    }
    return eras;
  }

  const has60 = decades.includes("1960s");
  const has70 = decades.includes("1970s");
  // A 1960s-born team without a 1970s pill is not a real case today, but keep
  // the decade reachable if it ever happens.
  if (has60 && !has70) {
    eras.push({ id: "1960s", label: "1960s", decades: ["1960s"] });
  }
  for (const d of decades) {
    if (d === "1960s") continue; // folded into the 1970s pill below
    if (d === "1970s") {
      eras.push({ id: "1970s", label: "1970s", decades: has60 ? ["1960s", "1970s"] : ["1970s"] });
    } else if (year(d) >= PRE_EXPANSION_BEFORE) {
      eras.push({ id: d, label: d, decades: [d] });
    }
  }
  return eras;
}

/* --------------------------------------------------------------- display */
const POSITIONS: Record<string, string> = {
  C: "Centre",
  L: "Left Wing",
  R: "Right Wing",
  D: "Defence",
  G: "Goaltender",
};

export function positionName(code: string): string {
  return POSITIONS[code] ?? code;
}

/** One-line reveal explaining the correct answer on the game-over screen. */
export function revealLine(p: Player, teamCode: string, teamShort: string): string {
  const eras = p.decadesActive.join(", ");
  if (playedForTeam(p, teamCode)) {
    const gp = p.teamGP[teamCode] ?? 0;
    const when = (p.teamDecades[teamCode] ?? []).join(", ");
    return `Yes — ${gp} regular-season game${gp === 1 ? "" : "s"} for the ${teamShort}${
      when ? ` (${when})` : ""
    }.`;
  }
  const played = p.teams.length
    ? `played for ${p.teams.join(", ")}`
    : `${p.careerGP} NHL games`;
  return `No — ${played} across ${p.teamCount} club${
    p.teamCount === 1 ? "" : "s"
  } (${eras}), never the ${teamShort}.`;
}
