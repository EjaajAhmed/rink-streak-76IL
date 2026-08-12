"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { TEAMS, themeVars } from "../lib/teams";

const DIVISIONS: { name: string; codes: string[] }[] = [
  { name: "Atlantic", codes: ["TOR", "MTL", "BOS", "BUF", "DET", "FLA", "OTT", "TBL"] },
  { name: "Metropolitan", codes: ["CAR", "CBJ", "NJD", "NYI", "NYR", "PHI", "PIT", "WSH"] },
  { name: "Central", codes: ["CHI", "COL", "DAL", "MIN", "NSH", "STL", "UTA", "WPG"] },
  { name: "Pacific", codes: ["ANA", "CGY", "EDM", "LAK", "SJS", "SEA", "VAN", "VGK"] },
];

function matches(code: string, q: string): boolean {
  const t = TEAMS[code];
  const hay = `${code} ${t.name} ${t.short} ${t.slug}`.toLowerCase();
  return hay.includes(q);
}

function TeamBadge({ code }: { code: string }) {
  const t = TEAMS[code];
  return (
    <Link
      href={`/${t.slug}`}
      prefetch={false}
      className="team-badge flex flex-col items-center gap-2 text-center"
    >
      <div
        style={themeVars(code) as React.CSSProperties}
        className="disc flex h-[4.5rem] w-[4.5rem] items-center justify-center sm:h-20 sm:w-20"
      >
        <span className="text-sm font-extrabold tracking-wider">{code}</span>
      </div>
      <span className="text-[0.7rem] font-semibold uppercase tracking-wide text-ink">
        {t.short}
      </span>
    </Link>
  );
}

export default function TeamBrowser() {
  const [q, setQ] = useState("");
  const query = q.trim().toLowerCase();

  const flat = useMemo(() => {
    if (!query) return null;
    return DIVISIONS.flatMap((d) => d.codes).filter((c) => matches(c, query));
  }, [query]);

  return (
    <div>
      {/* Search */}
      <div className="mx-auto mb-8 max-w-md">
        <div className="search flex items-center gap-3 px-3 py-2.5">
          <span className="puck h-3.5 w-3.5 shrink-0" aria-hidden />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search teams — name, city or code…"
            aria-label="Search teams"
            className="w-full text-sm placeholder:text-ink-soft/70"
          />
          {q && (
            <button
              onClick={() => setQ("")}
              aria-label="Clear search"
              className="text-ink-soft hover:text-ink"
            >
              ×
            </button>
          )}
        </div>
      </div>

      {flat ? (
        flat.length ? (
          <div className="grid grid-cols-3 gap-x-3 gap-y-6 sm:grid-cols-4 md:grid-cols-6">
            {flat.map((code) => (
              <TeamBadge key={code} code={code} />
            ))}
          </div>
        ) : (
          <p className="py-8 text-center text-sm text-ink-soft">
            No teams match “{q}”.
          </p>
        )
      ) : (
        <div className="space-y-8">
          {DIVISIONS.map((div) => (
            <section key={div.name}>
              <div className="mb-4 flex items-center gap-3">
                <h2 className="block text-xs tracking-widest text-ink-soft">
                  {div.name}
                </h2>
                <span className="h-px flex-1 bg-ink/10" />
              </div>
              <div className="grid grid-cols-4 gap-x-3 gap-y-6 sm:grid-cols-4 md:grid-cols-8">
                {div.codes.map((code) => (
                  <TeamBadge key={code} code={code} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
