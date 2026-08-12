import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { TEAMS, TEAM_CODES, SLUG_TO_CODE, themeVars } from "../lib/teams";
import { SITE_NAME } from "../lib/config";
import Game from "./Game";

type Params = { team: string };

// Pre-render one static page per team slug (per-team routes, principle 5).
export function generateStaticParams(): Params[] {
  return TEAM_CODES.map((code) => ({ team: TEAMS[code].slug }));
}

export function generateMetadata({ params }: { params: Params }): Metadata {
  const code = SLUG_TO_CODE[params.team];
  if (!code) return {};
  const t = TEAMS[code];
  const title = `${t.name} streak — ${SITE_NAME}`;
  const description = `Did this player ever play a game for the ${t.name}? Build the longest streak of correct guesses.`;
  return { title, description };
}

export default function TeamPage({ params }: { params: Params }) {
  const code = SLUG_TO_CODE[params.team];
  if (!code) notFound();

  return (
    <div style={themeVars(code) as React.CSSProperties}>
      <Game teamCode={code} />
    </div>
  );
}
