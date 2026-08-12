// Single source of truth for cross-cutting config (BUILD_PLAN principle 2).
// The public brand name is deliberately undecided — change it in ONE place here
// and it updates everywhere. Never hardcode a site name in a component.
export const SITE_NAME = "didtheyhockey";
export const SITE_TAGLINE = "Are you a true fan?";

// Casual = "more popular players": a substantial career OR currently active
// (current players count regardless of games, since they're recognizable now).
export const CASUAL_MIN_GP = 500;

// Hardcore difficulty knobs (client-side; tuning these needs no data rebuild).
export const HARDCORE_SECONDS = 10;
export const HARDCORE_TEAM_MAX_GP = 82; // Leaf-side gimme cutoff, now per active team
export const HARDCORE_MIN_TEAMS = 3; // non-team players need > this many clubs

// The active team is a minority of any pool, so uniform random buries it under
// "No" answers. Bias selection toward the active team to this rate — below 0.5
// so "No" can't be a safe coin-flip default. (BUILD_PLAN principle: this bias
// lives in the seed-driven picker, not scattered in the UI.)
export const TEAM_APPEARANCE_RATE = 0.4;
