import { TEAM_CODES } from "./lib/teams";
import { SITE_NAME } from "./lib/config";
import AuthWidget from "./components/AuthWidget";
import TeamBrowser from "./components/TeamBrowser";

export default function Landing() {
  return (
    <main className="min-h-screen">
      {/* Announcement strip */}
      <div className="announce py-2 text-center text-[0.65rem] font-semibold uppercase tracking-[0.2em]">
        Fan-made · all {TEAM_CODES.length} NHL teams · no login required
      </div>

      {/* Logo band — on the original background (transparent logo) */}
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/logo.png"
          alt={`${SITE_NAME}?`}
          className="h-9 w-auto sm:h-12"
        />
        <AuthWidget />
      </div>

      {/* Hero: sweeping arc + the puck */}
      <section className="relative mx-auto max-w-5xl overflow-hidden px-4">
        <div className="relative flex min-h-[15rem] items-center justify-center py-12 text-center sm:min-h-[18rem]">
          {/* the big cream arc, only its curve shows on the left */}
          <div className="hero-arc left-[-40%] top-[-30%] h-[34rem] w-[34rem] sm:left-[-22%]" />

          <div className="relative z-10 flex flex-col items-center">
            <div className="puck flex h-44 w-44 items-center justify-center p-6 text-center sm:h-52 sm:w-52">
              <span className="text-xl font-black uppercase leading-tight tracking-wide sm:text-2xl">
                Are you
                <br />a true
                <br />fan?
              </span>
            </div>
            <p className="mx-auto mt-6 max-w-md text-sm text-ink-soft">
              Pick a team — did each player <strong>ever</strong> suit up for
              them? Build a streak; one miss ends the run.
            </p>
          </div>
        </div>
      </section>

      {/* Team picker */}
      <section className="mx-auto max-w-5xl px-4 pb-16 pt-4">
        <p className="mb-4 text-center text-xs font-semibold uppercase tracking-widest text-ink-soft">
          Choose your team
        </p>
        <TeamBrowser />
        <p className="mt-12 text-center text-[0.7rem] uppercase tracking-widest text-ink-soft/70">
          Fan project · not affiliated with the NHL · data: NHL API + Hockey
          Databank
        </p>
      </section>
    </main>
  );
}
