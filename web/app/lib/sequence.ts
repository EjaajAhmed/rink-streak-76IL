// Seed-driven player sequence (BUILD_PLAN principle 4). Given a pool + a seed,
// this deterministically yields the run's order of players. The same seed always
// produces the same sequence — the foundation for replay/verification, daily
// challenges, and identical 1v1 sequences later. Nothing here calls Math.random.

import { mulberry32 } from "./rng";
import { playedForTeam, type Player } from "./players";
import { TEAM_APPEARANCE_RATE } from "./config";

export type Sequencer = {
  /** Next player to show, or null if the pool is empty. */
  next: () => Player | null;
};

/**
 * Build a deterministic sequencer over `pool` for the active team.
 *
 * Selection biases toward players who DID play for the active team at
 * `TEAM_APPEARANCE_RATE`, so the "No" majority doesn't bury them (v1's Leaf
 * bias, generalized). Within the chosen side it avoids repeats until that side
 * is exhausted, then recycles — all driven off the seeded RNG.
 */
export function makeSequencer(
  pool: Player[],
  teamCode: string,
  seed: number,
): Sequencer {
  const rand = mulberry32(seed);
  const yes = pool.filter((p) => playedForTeam(p, teamCode));
  const no = pool.filter((p) => !playedForTeam(p, teamCode));
  const recent = new Set<number>();

  const pick = (group: Player[]): Player => {
    let avail = group.filter((p) => !recent.has(p.id));
    if (avail.length === 0) {
      group.forEach((p) => recent.delete(p.id));
      avail = group;
    }
    const chosen = avail[Math.floor(rand() * avail.length)];
    recent.add(chosen.id);
    return chosen;
  };

  return {
    next() {
      if (pool.length === 0) return null;
      const wantYes = rand() < TEAM_APPEARANCE_RATE;
      let group: Player[];
      if (wantYes && yes.length > 0) group = yes;
      else if (!wantYes && no.length > 0) group = no;
      else group = yes.length > 0 ? yes : no;
      return pick(group);
    },
  };
}
