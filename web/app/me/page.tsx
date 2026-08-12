"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "../lib/auth";
import { getBrowserSupabase } from "../lib/supabase/client";
import { TEAMS } from "../lib/teams";
import { SITE_NAME } from "../lib/config";
import AuthWidget from "../components/AuthWidget";
import { fetchProfileStats, type ProfileStats } from "../lib/stats";

export default function ProfilePage() {
  const { configured, loading, user } = useAuth();
  const [stats, setStats] = useState<ProfileStats | null>(null);

  useEffect(() => {
    const sb = getBrowserSupabase();
    if (!user || !sb) return;
    let alive = true;
    fetchProfileStats(sb, user.id).then((s) => {
      if (alive) setStats(s);
    });
    return () => {
      alive = false;
    };
  }, [user]);

  // Name = the email name before "@" (no separate display-name concept).
  const name = user?.email ? user.email.split("@")[0] : "";
  // Favourite team is derived: the team you've streaked highest on.
  const favourite = stats?.perTeam.find((t) => t.best > 0) ?? null;

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col px-4 pb-12">
      <div className="flex items-center justify-between pt-5 text-[0.7rem] font-semibold uppercase tracking-widest text-ink-soft">
        <Link href="/" prefetch={false} className="hover:text-team">
          ← {SITE_NAME}
        </Link>
        <AuthWidget />
      </div>

      <h1 className="mt-6 block text-3xl text-ink sm:text-4xl">My profile</h1>

      {!configured ? (
        <Note>Accounts aren&apos;t enabled on this deployment yet.</Note>
      ) : loading ? (
        <Note>Loading…</Note>
      ) : !user ? (
        <Note>
          Sign in (top-right) to see your streak stats across every team. You can
          keep playing as a guest without an account.
        </Note>
      ) : (
        <>
          {/* Identity */}
          <section className="card mt-5 p-5">
            <div className="text-xs tracking-widest text-ink-soft">
              Signed in as
            </div>
            <div className="mt-1 text-xl text-ink">{name}</div>

            <div className="mb-1 mt-4 block text-xs tracking-widest text-ink-soft">
              Favourite team
            </div>
            <div className="rounded-[4px] border-2 border-dashed border-ink/20 bg-white/40 px-3 py-2 text-sm text-ink">
              {favourite ? (
                <>
                  <span className="font-bold">
                    {TEAMS[favourite.teamCode]?.name ?? favourite.teamCode}
                  </span>
                  <span className="text-ink-soft">
                    {" "}
                    — your best streak ({favourite.best})
                  </span>
                </>
              ) : (
                <span className="text-ink-soft">
                  Play a few games — whichever team you streak highest on becomes
                  your favourite.
                </span>
              )}
            </div>
          </section>

          {/* Overall */}
          <div className="mt-5 grid grid-cols-3 gap-3">
            <StatTile label="Best streak" value={stats?.overall.best ?? 0} />
            <StatTile label="Games" value={stats?.overall.games ?? 0} />
            <StatTile
              label="Avg streak"
              value={(stats?.overall.avg ?? 0).toFixed(1)}
            />
          </div>

          {/* Per-team */}
          <h2 className="mb-2 mt-7 block text-sm text-ink">By team</h2>
          {stats && stats.perTeam.length > 0 ? (
            <div className="card overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-ink/10 text-left text-[0.7rem] uppercase tracking-widest text-ink-soft">
                    <th className="px-4 py-2 font-semibold">Team</th>
                    <th className="px-3 py-2 text-right font-semibold">Best</th>
                    <th className="px-3 py-2 text-right font-semibold">Games</th>
                    <th className="px-4 py-2 text-right font-semibold">Avg</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.perTeam.map((t) => (
                    <tr
                      key={t.teamCode}
                      className="border-b border-ink/5 last:border-0"
                    >
                      <td className="px-4 py-2 text-ink">
                        <Link
                          href={`/${TEAMS[t.teamCode]?.slug ?? ""}`}
                          prefetch={false}
                          className="hover:text-team"
                        >
                          {TEAMS[t.teamCode]?.short ?? t.teamCode}
                        </Link>
                      </td>
                      <td className="px-3 py-2 text-right font-bold text-ink">
                        {t.best}
                      </td>
                      <td className="px-3 py-2 text-right text-ink-soft">
                        {t.games}
                      </td>
                      <td className="px-4 py-2 text-right text-ink-soft">
                        {t.avg.toFixed(1)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Note>No games yet — go start a streak on any team page.</Note>
          )}
        </>
      )}
    </main>
  );
}

function Note({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-6 rounded-[4px] border border-ink/15 bg-white/60 p-5 text-sm text-ink-soft">
      {children}
    </p>
  );
}

function StatTile({
  label,
  value,
}: {
  label: string;
  value: number | string;
}) {
  return (
    <div className="enamel px-3 py-3 text-center">
      <div className="block text-[0.65rem] tracking-widest opacity-80">
        {label}
      </div>
      <div className="numeral text-3xl font-bold leading-tight">{value}</div>
    </div>
  );
}
