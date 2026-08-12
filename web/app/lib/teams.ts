// NHL team theme config for the multi-team streak build.
//
// Keyed by the team's NHL API abbreviation (the same code the ETL uses in
// players.json), so team lookups line up with the data pipeline with no mapping.
//
// `primary`   = the dominant colour the page/window themes to (used as a fill/
//               background). For teams whose signature colour is very bright
//               (oranges, golds) the darker brand colour is used as primary so
//               it works as a background; the bright colour becomes `secondary`.
//               Any team can be flipped trivially since it's just config.
// `secondary` = accent colour.
// `text`      = a colour guaranteed to read against `primary` (dark text on the
//               bright primaries, white on the dark ones).
// `slug`      = URL segment for the per-team route (/maple-leafs, ...).

export type Team = {
  slug: string;
  name: string; // full name
  short: string; // short name for headings/switcher
  primary: string;
  secondary: string;
  text: string;
};

export const TEAMS: Record<string, Team> = {
  // Atlantic
  TOR: { slug: "maple-leafs",    name: "Toronto Maple Leafs",     short: "Maple Leafs",    primary: "#00205B", secondary: "#FFFFFF", text: "#FFFFFF" },
  MTL: { slug: "canadiens",      name: "Montreal Canadiens",      short: "Canadiens",      primary: "#AF1E2D", secondary: "#192168", text: "#FFFFFF" },
  BOS: { slug: "bruins",         name: "Boston Bruins",           short: "Bruins",         primary: "#111111", secondary: "#FFB81C", text: "#FFFFFF" },
  BUF: { slug: "sabres",         name: "Buffalo Sabres",          short: "Sabres",         primary: "#003087", secondary: "#FFB81C", text: "#FFFFFF" },
  DET: { slug: "red-wings",      name: "Detroit Red Wings",       short: "Red Wings",      primary: "#CE1126", secondary: "#FFFFFF", text: "#FFFFFF" },
  FLA: { slug: "panthers",       name: "Florida Panthers",        short: "Panthers",       primary: "#041E42", secondary: "#C8102E", text: "#FFFFFF" },
  OTT: { slug: "senators",       name: "Ottawa Senators",         short: "Senators",       primary: "#111111", secondary: "#C52032", text: "#FFFFFF" },
  TBL: { slug: "lightning",      name: "Tampa Bay Lightning",     short: "Lightning",      primary: "#00205B", secondary: "#FFFFFF", text: "#FFFFFF" },

  // Metropolitan
  CAR: { slug: "hurricanes",     name: "Carolina Hurricanes",     short: "Hurricanes",     primary: "#CC0000", secondary: "#111111", text: "#FFFFFF" },
  CBJ: { slug: "blue-jackets",   name: "Columbus Blue Jackets",   short: "Blue Jackets",   primary: "#002654", secondary: "#CE1126", text: "#FFFFFF" },
  NJD: { slug: "devils",         name: "New Jersey Devils",       short: "Devils",         primary: "#CE1126", secondary: "#111111", text: "#FFFFFF" },
  NYI: { slug: "islanders",      name: "New York Islanders",      short: "Islanders",      primary: "#00539B", secondary: "#F47D30", text: "#FFFFFF" },
  NYR: { slug: "rangers",        name: "New York Rangers",        short: "Rangers",        primary: "#0038A8", secondary: "#CE1126", text: "#FFFFFF" },
  PHI: { slug: "flyers",         name: "Philadelphia Flyers",     short: "Flyers",         primary: "#F74902", secondary: "#111111", text: "#111111" },
  PIT: { slug: "penguins",       name: "Pittsburgh Penguins",     short: "Penguins",       primary: "#111111", secondary: "#FCB514", text: "#FFFFFF" },
  WSH: { slug: "capitals",       name: "Washington Capitals",     short: "Capitals",       primary: "#041E42", secondary: "#C8102E", text: "#FFFFFF" },

  // Central
  CHI: { slug: "blackhawks",     name: "Chicago Blackhawks",      short: "Blackhawks",     primary: "#CF0A2C", secondary: "#111111", text: "#FFFFFF" },
  COL: { slug: "avalanche",      name: "Colorado Avalanche",      short: "Avalanche",      primary: "#6F263D", secondary: "#236192", text: "#FFFFFF" },
  DAL: { slug: "stars",          name: "Dallas Stars",            short: "Stars",          primary: "#006847", secondary: "#111111", text: "#FFFFFF" },
  MIN: { slug: "wild",           name: "Minnesota Wild",          short: "Wild",           primary: "#154734", secondary: "#A6192E", text: "#FFFFFF" },
  NSH: { slug: "predators",      name: "Nashville Predators",     short: "Predators",      primary: "#FFB81C", secondary: "#041E42", text: "#111111" },
  STL: { slug: "blues",          name: "St. Louis Blues",         short: "Blues",          primary: "#002F87", secondary: "#FCB514", text: "#FFFFFF" },
  UTA: { slug: "mammoth",        name: "Utah Mammoth",            short: "Mammoth",        primary: "#010101", secondary: "#71AFE5", text: "#FFFFFF" },
  WPG: { slug: "jets",           name: "Winnipeg Jets",           short: "Jets",           primary: "#041E42", secondary: "#AC162C", text: "#FFFFFF" },

  // Pacific
  ANA: { slug: "ducks",          name: "Anaheim Ducks",           short: "Ducks",          primary: "#111111", secondary: "#F47A38", text: "#FFFFFF" },
  CGY: { slug: "flames",         name: "Calgary Flames",          short: "Flames",         primary: "#C8102E", secondary: "#F1BE48", text: "#FFFFFF" },
  EDM: { slug: "oilers",         name: "Edmonton Oilers",         short: "Oilers",         primary: "#041E42", secondary: "#FF4C00", text: "#FFFFFF" },
  LAK: { slug: "kings",          name: "Los Angeles Kings",       short: "Kings",          primary: "#111111", secondary: "#A2AAAD", text: "#FFFFFF" },
  SJS: { slug: "sharks",         name: "San Jose Sharks",         short: "Sharks",         primary: "#006D75", secondary: "#EA7200", text: "#FFFFFF" },
  SEA: { slug: "kraken",         name: "Seattle Kraken",          short: "Kraken",         primary: "#001628", secondary: "#99D9D9", text: "#FFFFFF" },
  VAN: { slug: "canucks",        name: "Vancouver Canucks",       short: "Canucks",        primary: "#00205B", secondary: "#00843D", text: "#FFFFFF" },
  VGK: { slug: "golden-knights", name: "Vegas Golden Knights",    short: "Golden Knights", primary: "#333F48", secondary: "#B9975B", text: "#FFFFFF" },
};

// Order helper for a team switcher / landing grid.
export const TEAM_CODES = Object.keys(TEAMS);

// slug -> code, for resolving a /[team] route param back to a team code.
export const SLUG_TO_CODE: Record<string, string> = Object.fromEntries(
  Object.entries(TEAMS).map(([code, t]) => [t.slug, code]),
);

// Theme custom properties for a team, as an inline-style object. Set these on a
// wrapping element (server-side, so there's no theme flash) and components read
// var(--team-primary) etc. instead of hardcoding any colour.
export function themeVars(code: string): Record<string, string> {
  const t = TEAMS[code];
  if (!t) return {};
  return {
    "--team-primary": t.primary,
    "--team-secondary": t.secondary,
    "--team-text": t.text,
  };
}

// Imperative variant: apply a team's theme by setting the same custom properties
// on an element (e.g. for a client-side team switch). Prefer themeVars() for SSR.
export function applyTeamTheme(code: string, el: HTMLElement) {
  const vars = themeVars(code);
  for (const [k, v] of Object.entries(vars)) el.style.setProperty(k, v);
}
