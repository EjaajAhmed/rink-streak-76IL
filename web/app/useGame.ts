"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  buildEras,
  buildPool,
  isCorrect,
  type Era,
  type Mode,
  type Player,
} from "./lib/players";
import { makeSequencer, type Sequencer } from "./lib/sequence";
import { randomSeed } from "./lib/rng";
import { HARDCORE_SECONDS } from "./lib/config";
import { useAuth } from "./lib/auth";
import { getBrowserSupabase } from "./lib/supabase/client";
import {
  fetchBests,
  importLocalBests,
  recordRun,
  upsertBest,
  type BestMap,
} from "./lib/stats";

export type Status = "loading" | "error" | "ready" | "playing" | "over";

export type RunResult = {
  player: Player;
  reason: "wrong" | "timeout";
  guess: boolean | null; // what the user pressed (null on timeout)
  streak: number; // streak achieved before this run ended
};

// Best streaks are tracked per (team, mode, era): "TOR.hardcore.1990s", …
const bestKey = (team: string, mode: Mode, eraId: string) =>
  `${team}.${mode}.${eraId}`;
const PREFIX = "rinkstreak.best.";
const storeKey = (k: string) => `${PREFIX}${k}`;

export function useGame(teamCode: string) {
  const { user } = useAuth();
  const [players, setPlayers] = useState<Player[]>([]);
  const [status, setStatus] = useState<Status>("loading");
  const [mode, setMode] = useState<Mode>("casual");
  const [eraId, setEraId] = useState<string>("all"); // "all" is the default
  const [current, setCurrent] = useState<Player | null>(null);
  const [streak, setStreak] = useState(0);
  const [best, setBest] = useState<Record<string, number>>({});
  const [result, setResult] = useState<RunResult | null>(null);
  const [timeLeft, setTimeLeft] = useState(HARDCORE_SECONDS);
  const [importable, setImportable] = useState(0); // local bests not yet synced

  const seq = useRef<Sequencer | null>(null);
  const runSeed = useRef<number>(0); // seed of the in-progress run (for logging)
  const localBests = useRef<BestMap>({}); // snapshot of localStorage bests at mount

  const eras = useMemo(() => buildEras(players, teamCode), [players, teamCode]);
  const era: Era = useMemo(
    () => eras.find((e) => e.id === eraId) ?? eras[0],
    [eras, eraId],
  );
  const pool = useMemo(
    () => buildPool(players, teamCode, mode, era ? era.decades : null),
    [players, teamCode, mode, era],
  );
  const bestForCurrent = best[bestKey(teamCode, mode, eraId)] ?? 0;

  // Load the static dataset once.
  useEffect(() => {
    let alive = true;
    fetch("/players.json")
      .then((r) => {
        if (!r.ok) throw new Error(String(r.status));
        return r.json();
      })
      .then((data: Player[]) => {
        if (!alive) return;
        setPlayers(data);
        setStatus("ready");
      })
      .catch(() => alive && setStatus("error"));
    return () => {
      alive = false;
    };
  }, []);

  // Restore best streaks from localStorage (keys "<team>.<mode>.<era>").
  useEffect(() => {
    try {
      const map: Record<string, number> = {};
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (!k || !k.startsWith(PREFIX)) continue;
        map[k.slice(PREFIX.length)] = Number(localStorage.getItem(k) || 0);
      }
      localBests.current = map;
      setBest(map);
    } catch {
      /* localStorage unavailable — bests stay empty */
    }
  }, []);

  // On sign-in, merge the account's saved bests in (take the higher of the two)
  // and figure out whether any local bests still need importing.
  useEffect(() => {
    const sb = getBrowserSupabase();
    if (!user || !sb) {
      setImportable(0);
      return;
    }
    let alive = true;
    fetchBests(sb, user.id).then((server) => {
      if (!alive) return;
      setBest((prev) => {
        const merged = { ...prev };
        for (const [k, v] of Object.entries(server)) {
          merged[k] = Math.max(merged[k] ?? 0, v);
        }
        return merged;
      });
      const pending = Object.entries(localBests.current).filter(
        ([k, v]) => v > (server[k] ?? 0),
      ).length;
      setImportable(pending);
    });
    return () => {
      alive = false;
    };
  }, [user]);

  const advance = useCallback(() => {
    const p = seq.current?.next() ?? null;
    setCurrent(p);
    setTimeLeft(HARDCORE_SECONDS);
  }, []);

  const start = useCallback(() => {
    if (pool.length === 0) return;
    runSeed.current = randomSeed();
    seq.current = makeSequencer(pool, teamCode, runSeed.current);
    setStreak(0);
    setResult(null);
    setStatus("playing");
    advance();
  }, [pool, teamCode, advance]);

  // End-of-run bookkeeping, held in a ref so the timer can call the latest one.
  const endRun = useCallback(
    (reason: "wrong" | "timeout", guess: boolean | null) => {
      setCurrent((cur) => {
        if (cur) setResult({ player: cur, reason, guess, streak });
        return cur;
      });
      setStatus("over");

      const key = bestKey(teamCode, mode, eraId);
      let isNewBest = false;
      setBest((prev) => {
        if (streak <= (prev[key] ?? 0)) return prev;
        isNewBest = true;
        try {
          localStorage.setItem(storeKey(key), String(streak));
          localBests.current[key] = streak;
        } catch {
          /* ignore */
        }
        return { ...prev, [key]: streak };
      });

      // Cloud write-through for signed-in players (fire-and-forget). Every run
      // is logged; a new best is upserted. Guests hit neither branch.
      const sb = getBrowserSupabase();
      if (user && sb) {
        recordRun(sb, user.id, {
          team_code: teamCode,
          mode,
          era_id: eraId,
          seed: runSeed.current || null,
          streak,
          ended_reason: reason,
        }).catch(() => {});
        if (isNewBest) {
          upsertBest(sb, user.id, teamCode, mode, eraId, streak).catch(() => {});
        }
      }
    },
    [teamCode, mode, eraId, streak, user],
  );

  const timeoutRef = useRef<() => void>(() => {});
  useEffect(() => {
    timeoutRef.current = () => endRun("timeout", null);
  }, [endRun]);

  const answer = useCallback(
    (guess: boolean) => {
      if (status !== "playing" || !current) return;
      if (isCorrect(current, teamCode, guess)) {
        setStreak((s) => s + 1);
        advance();
      } else {
        endRun("wrong", guess);
      }
    },
    [status, current, teamCode, advance, endRun],
  );

  // Hardcore countdown. Restarts whenever a new player is shown.
  useEffect(() => {
    if (status !== "playing" || mode !== "hardcore" || !current) return;
    setTimeLeft(HARDCORE_SECONDS);
    const deadline = Date.now() + HARDCORE_SECONDS * 1000;
    const id = window.setInterval(() => {
      const remaining = Math.max(0, (deadline - Date.now()) / 1000);
      setTimeLeft(remaining);
      if (remaining <= 0) {
        window.clearInterval(id);
        timeoutRef.current();
      }
    }, 100);
    return () => window.clearInterval(id);
  }, [status, mode, current]);

  const chooseMode = useCallback((m: Mode) => setMode(m), []);
  const chooseEra = useCallback((id: string) => setEraId(id), []);

  // Import local best streaks into the signed-in account (idempotent MAX).
  const importLocal = useCallback(async () => {
    const sb = getBrowserSupabase();
    if (!user || !sb) return;
    await importLocalBests(sb, user.id, localBests.current);
    setImportable(0);
  }, [user]);
  const dismissImport = useCallback(() => setImportable(0), []);

  return {
    status,
    mode,
    era,
    eraId,
    eras,
    pool,
    current,
    streak,
    best,
    bestForCurrent,
    result,
    timeLeft,
    start,
    answer,
    chooseMode,
    chooseEra,
    importable,
    importLocal,
    dismissImport,
  };
}
