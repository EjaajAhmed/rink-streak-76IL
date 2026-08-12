"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useGame } from "../useGame";
import { TEAMS } from "../lib/teams";
import { HARDCORE_SECONDS } from "../lib/config";
import AuthWidget from "../components/AuthWidget";
import {
  positionName,
  revealLine,
  type Mode,
  type Player,
} from "../lib/players";

// Compact era name for scoreboard / summary labels.
function eraShort(eraId: string, eraLabel: string): string {
  if (eraId === "all") return "all eras";
  if (eraId === "pre1970") return "pre-1970";
  return eraLabel;
}

export default function Game({ teamCode }: { teamCode: string }) {
  const team = TEAMS[teamCode];
  const g = useGame(teamCode);

  // Keyboard: Y / → = yes, N / ← = no, while playing.
  useEffect(() => {
    if (g.status !== "playing") return;
    const onKey = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (k === "y" || e.key === "ArrowRight") g.answer(true);
      else if (k === "n" || e.key === "ArrowLeft") g.answer(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [g.status, g]);

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col px-4 pb-10">
      <Header teamCode={teamCode} teamName={team.name} teamShort={team.short} />
      <Scoreboard
        streak={g.streak}
        best={g.bestForCurrent}
        mode={g.mode}
        era={eraShort(g.eraId, g.era.label)}
      />

      <section className="card mt-5 overflow-hidden">
        <div className="hem" />
        <div className="p-5 sm:p-7">
          {g.status === "loading" && (
            <div className="flex flex-col items-center gap-4 py-10 text-sm font-semibold text-ink-soft">
              <span className="puck puck-spin h-10 w-10" aria-hidden />
              Lacing up…
            </div>
          )}
          {g.status === "error" && (
            <Centered>
              Couldn&apos;t load the roster data. Check that{" "}
              <code>players.json</code> is present.
            </Centered>
          )}

          {(g.status === "ready" || g.status === "over") && (
            <>
              {g.status === "over" && g.result && (
                <GameOver
                  result={g.result}
                  teamCode={teamCode}
                  teamShort={team.short}
                  mode={g.mode}
                  era={eraShort(g.eraId, g.era.label)}
                />
              )}
              {g.importable > 0 && (
                <ImportPrompt
                  count={g.importable}
                  onImport={g.importLocal}
                  onDismiss={g.dismissImport}
                />
              )}
              <StartPanel g={g} />
            </>
          )}

          {g.status === "playing" && g.current && (
            <PlayPanel
              player={g.current}
              teamName={team.name}
              mode={g.mode}
              timeLeft={g.timeLeft}
              onAnswer={g.answer}
            />
          )}
        </div>
        <div className="hem" />
      </section>

      {g.status !== "playing" && <HowToPlay teamShort={team.short} />}

      <Footer teamName={team.name} />
    </main>
  );
}

/* ---------------------------------------------------------------- header */
function Header({
  teamCode,
  teamName,
  teamShort,
}: {
  teamCode: string;
  teamName: string;
  teamShort: string;
}) {
  return (
    <header className="pt-6 text-center">
      <div className="mb-4 flex items-center justify-between text-[0.7rem] font-semibold uppercase tracking-widest text-ink-soft">
        <Link href="/" prefetch={false} className="hover:text-team">
          ← all teams
        </Link>
        <AuthWidget />
      </div>
      <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full crest">
        <span className="text-sm font-bold leading-none">{teamCode}</span>
      </div>
      <h1 className="block text-3xl leading-none text-ink sm:text-4xl">
        {teamName}
      </h1>
      <p className="mt-2 text-sm font-semibold uppercase tracking-widest text-ink-soft">
        Did they ever play for the {teamShort}?
      </p>
    </header>
  );
}

/* ------------------------------------------------------------ scoreboard */
function Scoreboard({
  streak,
  best,
  mode,
  era,
}: {
  streak: number;
  best: number;
  mode: Mode;
  era: string;
}) {
  return (
    <div className="mt-6 grid grid-cols-2 gap-3">
      <Tile label="Streak" value={streak} />
      <Tile label={`Best · ${mode} · ${era}`} value={best} />
    </div>
  );
}

function Tile({ label, value }: { label: string; value: number }) {
  return (
    <div className="enamel px-4 py-3 text-center">
      <div className="block text-[0.7rem] tracking-widest opacity-80">
        {label}
      </div>
      <div className="numeral text-4xl font-bold leading-tight">{value}</div>
    </div>
  );
}

/* ------------------------------------------------------------- start/over */
function StartPanel({ g }: { g: ReturnType<typeof useGame> }) {
  const empty = g.pool.length === 0;
  return (
    <div className="text-center">
      <h2 className="block text-2xl text-ink">
        {g.status === "over" ? "Next shift?" : "Face-off"}
      </h2>

      <div className="mt-5 grid grid-cols-1 gap-6 text-left sm:grid-cols-2 sm:gap-0">
        {/* Left side — Mode */}
        <div className="sm:pr-6">
          <div className="mb-3 block text-xs tracking-widest text-ink-soft">
            Mode
          </div>
          <div className="flex flex-col gap-3">
            {(["casual", "hardcore"] as Mode[]).map((m) => (
              <button
                key={m}
                onClick={() => g.chooseMode(m)}
                className={`fo-key ${g.mode === m ? "fo-key-on" : ""}`}
              >
                {m}
                <span className="mt-0.5 block text-[0.6rem] font-semibold normal-case tracking-wide opacity-75">
                  {m === "hardcore"
                    ? `${HARDCORE_SECONDS}s clock · only the tricky ones`
                    : "no clock · any recognizable player"}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Right side — Era, split by a centre line */}
        <div className="relative sm:border-l-2 sm:border-ink/10 sm:pl-6">
          <div className="mb-3 block text-xs tracking-widest text-ink-soft">
            Era
          </div>
          <div className="grid grid-cols-2 gap-2">
            {g.eras.map((era) => (
              <button
                key={era.id}
                onClick={() => g.chooseEra(era.id)}
                className={`fo-key ${g.eraId === era.id ? "fo-key-on" : ""}`}
              >
                {era.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <p className="mt-6 text-xs font-semibold uppercase tracking-wider text-ink-soft">
        {g.pool.length} players in the {g.mode} pool
      </p>

      <button
        onClick={g.start}
        disabled={empty}
        className="btn-answer btn-yes mt-5 w-full text-lg disabled:cursor-not-allowed disabled:opacity-40"
      >
        {g.status === "over" ? "Lace up again" : "Drop the puck"}
      </button>
      {empty && (
        <p className="mt-2 text-xs font-semibold text-penalty">
          No players match this era in hardcore. Try another era or casual mode.
        </p>
      )}
    </div>
  );
}

/* -------------------------------------------------------------- play view */
function PlayPanel({
  player,
  teamName,
  mode,
  timeLeft,
  onAnswer,
}: {
  player: Player;
  teamName: string;
  mode: Mode;
  timeLeft: number;
  onAnswer: (guess: boolean) => void;
}) {
  return (
    <div className="text-center">
      {mode === "hardcore" && <Clock timeLeft={timeLeft} />}

      <div className="relative mt-2 rounded-[4px] border border-ink/15 bg-white/60 px-4 py-6">
        <span className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full crest text-sm">
          {player.position}
        </span>
        <div className="block text-[0.7rem] tracking-widest text-ink-soft">
          {positionName(player.position)} · {player.decadesActive.join(" · ")}
        </div>
        <div className="mt-1 block text-3xl leading-tight text-ink sm:text-4xl">
          {player.name}
        </div>
      </div>

      <p className="mt-5 text-sm font-semibold uppercase tracking-wider text-ink-soft">
        Ever played a game for the {teamName}?
      </p>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <button className="btn-answer btn-no" onClick={() => onAnswer(false)}>
          No
          <span className="mt-1 block text-[0.65rem] font-semibold tracking-wider opacity-70">
            never there
          </span>
        </button>
        <button className="btn-answer btn-yes" onClick={() => onAnswer(true)}>
          Yes
          <span className="mt-1 block text-[0.65rem] font-semibold tracking-wider opacity-80">
            wore the sweater
          </span>
        </button>
      </div>

      <p className="mt-4 text-[0.7rem] uppercase tracking-widest text-ink-soft/70">
        Keys: N / ← = No · Y / → = Yes
      </p>
    </div>
  );
}

function Clock({ timeLeft }: { timeLeft: number }) {
  const pct = Math.max(0, Math.min(100, (timeLeft / HARDCORE_SECONDS) * 100));
  const warn = timeLeft <= 3;
  const secs = Math.ceil(timeLeft);
  return (
    <div className="mb-4">
      <div className="mb-1 flex items-baseline justify-between">
        <span className="block text-[0.7rem] tracking-widest text-ink-soft">
          Period clock
        </span>
        <span
          className={`numeral text-2xl font-bold ${warn ? "tick-warn" : "text-ink"}`}
        >
          0:{secs.toString().padStart(2, "0")}
        </span>
      </div>
      <div className="clock-track h-3">
        <div
          className={`clock-fill ${warn ? "warn" : ""}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

/* -------------------------------------------------------------- game over */
function GameOver({
  result,
  teamCode,
  teamShort,
  mode,
  era,
}: {
  result: NonNullable<ReturnType<typeof useGame>["result"]>;
  teamCode: string;
  teamShort: string;
  mode: Mode;
  era: string;
}) {
  const { player, reason, guess, streak } = result;
  return (
    <div className="mb-6 rounded-[4px] border-2 border-penalty/40 bg-white/70 p-5 text-center">
      <div className="block text-2xl text-penalty">
        {reason === "timeout" ? "Time!" : "Run over"}
      </div>
      <p className="mt-1 text-sm font-semibold text-ink-soft">
        {reason === "timeout"
          ? "The clock beat you."
          : guess
            ? `You said they played for the ${teamShort}.`
            : `You said they never did.`}
      </p>

      <div className="laces mx-auto mt-4 max-w-sm pt-4">
        <div className="block text-lg text-ink">{player.name}</div>
        <p className="mt-1 text-sm text-ink-soft">
          {revealLine(player, teamCode, teamShort)}
        </p>
      </div>

      <p className="mt-4 text-sm font-semibold uppercase tracking-wider text-ink-soft">
        Streak this run:{" "}
        <span className="numeral text-xl font-bold text-ink">{streak}</span> ·{" "}
        {mode} · {era}
      </p>
    </div>
  );
}

/* --------------------------------------------------------- import prompt */
function ImportPrompt({
  count,
  onImport,
  onDismiss,
}: {
  count: number;
  onImport: () => void;
  onDismiss: () => void;
}) {
  return (
    <div className="mb-5 flex items-center gap-3 rounded-[4px] border border-team/30 bg-white/70 p-3 text-left">
      <p className="flex-1 text-xs text-ink-soft">
        You have <strong className="text-ink">{count}</strong> local best
        streak{count === 1 ? "" : "s"} not saved to your account.
      </p>
      <button onClick={onImport} className="pill pill-active">
        Import
      </button>
      <button
        onClick={onDismiss}
        aria-label="Dismiss"
        className="text-ink-soft hover:text-ink"
      >
        ×
      </button>
    </div>
  );
}

/* ------------------------------------------------------------ how to play */
function HowToPlay({ teamShort }: { teamShort: string }) {
  return (
    <details className="card mt-4 overflow-hidden">
      <summary className="flex items-center justify-between px-5 py-3">
        <span className="block text-sm text-ink">How to play</span>
        <span className="howto-mark text-lg text-ink-soft">+</span>
      </summary>
      <div className="laces mx-5 mb-5 space-y-2 pt-3 text-sm text-ink-soft">
        <p>
          You&apos;re shown an NHL player. Guess whether they{" "}
          <strong>ever</strong> played a game for the {teamShort}.
        </p>
        <ul className="list-disc space-y-1 pl-5">
          <li>A right answer extends your streak; one miss ends the run.</li>
          <li>
            <strong>Casual</strong> — any recognizable player, no clock.
          </li>
          <li>
            <strong>Hardcore</strong> — only tricky ones (obscure {teamShort} &amp;
            well-travelled others) on a {HARDCORE_SECONDS}-second clock.
          </li>
          <li>
            Pick an era to narrow the pool. Best streak is saved per team, mode
            &amp; era.
          </li>
          <li>
            Keyboard: <strong>Y</strong> / → for yes, <strong>N</strong> / ← for
            no.
          </li>
        </ul>
      </div>
    </details>
  );
}

/* --------------------------------------------------------------- chrome */
function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="py-10 text-center text-sm font-semibold text-ink-soft">
      {children}
    </div>
  );
}

function Footer({ teamName }: { teamName: string }) {
  return (
    <footer className="mt-8 text-center text-[0.7rem] uppercase tracking-widest text-ink-soft/60">
      Fan project · not affiliated with the NHL or the {teamName} · data: NHL API
      + Hockey Databank
    </footer>
  );
}
