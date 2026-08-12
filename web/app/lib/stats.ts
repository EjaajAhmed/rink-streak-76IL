// Supabase persistence helpers for signed-in players. All are no-ops-safe: pass
// a real SupabaseClient (never null) — callers guard on auth/config first. Guest
// play never reaches here. Best streaks live in `best_streaks` (keyed
// team.mode.era); completed runs append to `runs` (games played + average).

import type { SupabaseClient } from "@supabase/supabase-js";

export type BestMap = Record<string, number>; // "TOR.hardcore.1990s" -> streak
export const bestMapKey = (team: string, mode: string, eraId: string) =>
  `${team}.${mode}.${eraId}`;

export type RunRow = {
  team_code: string;
  mode: string;
  era_id: string;
  seed: number | null;
  streak: number;
  ended_reason: string | null;
};

export type TeamStat = {
  teamCode: string;
  best: number;
  games: number;
  avg: number; // average streak across runs
};

export type ProfileStats = {
  overall: { best: number; games: number; avg: number };
  perTeam: TeamStat[];
};

export type Profile = {
  display_name: string | null;
  favourite_team: string | null;
};

/** Append one completed run. */
export async function recordRun(
  sb: SupabaseClient,
  userId: string,
  run: RunRow,
): Promise<void> {
  await sb.from("runs").insert({ user_id: userId, ...run });
}

/** Upsert a best streak. Callers only invoke this on a genuine new max, so a
 *  plain upsert already holds the MAX invariant. */
export async function upsertBest(
  sb: SupabaseClient,
  userId: string,
  team: string,
  mode: string,
  eraId: string,
  streak: number,
): Promise<void> {
  await sb.from("best_streaks").upsert(
    {
      user_id: userId,
      team_code: team,
      mode,
      era_id: eraId,
      streak,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,team_code,mode,era_id" },
  );
}

/** All of a user's best streaks as a BestMap. */
export async function fetchBests(
  sb: SupabaseClient,
  userId: string,
): Promise<BestMap> {
  const { data } = await sb
    .from("best_streaks")
    .select("team_code, mode, era_id, streak")
    .eq("user_id", userId);
  const map: BestMap = {};
  for (const r of data ?? []) {
    map[bestMapKey(r.team_code, r.mode, r.era_id)] = r.streak;
  }
  return map;
}

/** Import local bests, keeping the MAX against whatever is already stored. */
export async function importLocalBests(
  sb: SupabaseClient,
  userId: string,
  local: BestMap,
): Promise<number> {
  const server = await fetchBests(sb, userId);
  const rows = Object.entries(local)
    .filter(([k, v]) => v > (server[k] ?? 0))
    .map(([k, streak]) => {
      const [team_code, mode, era_id] = k.split(".");
      return {
        user_id: userId,
        team_code,
        mode,
        era_id,
        streak,
        updated_at: new Date().toISOString(),
      };
    });
  if (rows.length === 0) return 0;
  await sb
    .from("best_streaks")
    .upsert(rows, { onConflict: "user_id,team_code,mode,era_id" });
  return rows.length;
}

/** Per-team + overall aggregates for the profile page. */
export async function fetchProfileStats(
  sb: SupabaseClient,
  userId: string,
): Promise<ProfileStats> {
  const [{ data: runs }, bests] = await Promise.all([
    sb.from("runs").select("team_code, streak").eq("user_id", userId),
    fetchBests(sb, userId),
  ]);

  // Best per team = max across that team's era/mode bests.
  const bestByTeam: Record<string, number> = {};
  for (const [key, streak] of Object.entries(bests)) {
    const team = key.split(".")[0];
    bestByTeam[team] = Math.max(bestByTeam[team] ?? 0, streak);
  }

  // Games + average per team from the runs log.
  const agg: Record<string, { games: number; sum: number }> = {};
  for (const r of runs ?? []) {
    const a = (agg[r.team_code] ??= { games: 0, sum: 0 });
    a.games += 1;
    a.sum += r.streak;
  }

  const teams = new Set([...Object.keys(bestByTeam), ...Object.keys(agg)]);
  const perTeam: TeamStat[] = [...teams]
    .map((teamCode) => {
      const a = agg[teamCode] ?? { games: 0, sum: 0 };
      return {
        teamCode,
        best: bestByTeam[teamCode] ?? 0,
        games: a.games,
        avg: a.games ? a.sum / a.games : 0,
      };
    })
    .sort((x, y) => y.best - x.best || y.games - x.games);

  const totalGames = perTeam.reduce((n, t) => n + t.games, 0);
  const totalSum = (runs ?? []).reduce((n, r) => n + r.streak, 0);
  const overallBest = perTeam.reduce((m, t) => Math.max(m, t.best), 0);

  return {
    overall: {
      best: overallBest,
      games: totalGames,
      avg: totalGames ? totalSum / totalGames : 0,
    },
    perTeam,
  };
}

export async function fetchProfile(
  sb: SupabaseClient,
  userId: string,
): Promise<Profile> {
  const { data } = await sb
    .from("profiles")
    .select("display_name, favourite_team")
    .eq("id", userId)
    .single();
  return { display_name: data?.display_name ?? null, favourite_team: data?.favourite_team ?? null };
}

export async function updateProfile(
  sb: SupabaseClient,
  userId: string,
  patch: Partial<Profile>,
): Promise<void> {
  await sb.from("profiles").update(patch).eq("id", userId);
}
