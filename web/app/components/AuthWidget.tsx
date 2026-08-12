"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useAuth } from "../lib/auth";
import SignInPanel from "./SignInPanel";

// Non-intrusive account affordance. Renders NOTHING when Supabase isn't
// configured (guest-only build). Guest: a subtle "Sign in to save" link that
// opens the SignInPanel popover. Signed in: a small menu with Profile + Sign
// out, labelled by the email name (the part before "@"). The dropdown/popover
// closes on any outside click or Escape.
export default function AuthWidget() {
  const { configured, loading, user, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!configured || loading) return null;

  const name = user?.email ? user.email.split("@")[0] : "Account";

  return (
    <div ref={ref} className="relative inline-block">
      {!user ? (
        <>
          <button
            onClick={() => setOpen((v) => !v)}
            className="text-[0.7rem] font-semibold uppercase tracking-widest text-ink-soft underline decoration-dotted underline-offset-4 hover:text-team"
          >
            Sign in to save
          </button>
          {open && <SignInPanel onClose={() => setOpen(false)} />}
        </>
      ) : (
        <>
          <button
            onClick={() => setOpen((v) => !v)}
            className="flex items-center gap-2 text-[0.7rem] font-semibold uppercase tracking-widest text-ink-soft hover:text-team"
          >
            <span className="flex h-6 w-6 items-center justify-center rounded-full crest text-[0.6rem]">
              {name.slice(0, 1).toUpperCase()}
            </span>
            <span className="max-w-[10rem] truncate normal-case tracking-normal">
              {name}
            </span>
          </button>
          {open && (
            <div className="card absolute right-0 z-20 mt-2 w-44 p-2 text-left shadow-xl">
              <Link
                href="/me"
                prefetch={false}
                onClick={() => setOpen(false)}
                className="block rounded-[3px] px-3 py-2 text-sm text-ink hover:bg-ink/5"
              >
                My profile
              </Link>
              <button
                onClick={() => {
                  setOpen(false);
                  signOut();
                }}
                className="block w-full rounded-[3px] px-3 py-2 text-left text-sm text-ink hover:bg-ink/5"
              >
                Sign out
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
