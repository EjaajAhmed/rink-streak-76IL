"use client";

import { useState } from "react";
import { useAuth } from "../lib/auth";

// Lightweight sign-in popover — Google OAuth + magic-link email. Not a
// full-screen modal: it drops down from the AuthWidget and is dismissible.
export default function SignInPanel({ onClose }: { onClose: () => void }) {
  const { signInWithGoogle, signInWithEmail, googleEnabled } = useAuth();
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">(
    "idle",
  );
  const [error, setError] = useState<string>("");

  const sendLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setStatus("sending");
    const res = await signInWithEmail(email.trim());
    if (res.ok) {
      setStatus("sent");
    } else {
      setStatus("error");
      setError(res.error ?? "Something went wrong.");
    }
  };

  return (
    <div className="card absolute right-0 z-20 mt-2 w-72 p-4 text-left shadow-xl">
      <div className="mb-1 flex items-center justify-between">
        <span className="block text-sm text-ink">Save your stats</span>
        <button
          onClick={onClose}
          aria-label="Close"
          className="text-ink-soft hover:text-ink"
        >
          ×
        </button>
      </div>
      <p className="mb-3 text-xs text-ink-soft">
        Optional — your streaks sync to your account. You can keep playing as a
        guest.
      </p>

      {googleEnabled && (
        <>
          <button
            onClick={signInWithGoogle}
            className="btn-answer btn-no w-full text-sm"
          >
            Continue with Google
          </button>
          <div className="my-3 flex items-center gap-2 text-[0.65rem] uppercase tracking-widest text-ink-soft/70">
            <span className="h-px flex-1 bg-ink/15" /> or{" "}
            <span className="h-px flex-1 bg-ink/15" />
          </div>
        </>
      )}

      {status === "sent" ? (
        <p className="text-xs font-semibold text-ink">
          Check your inbox — we sent a sign-in link to{" "}
          <span className="text-team">{email}</span>.
        </p>
      ) : (
        <form onSubmit={sendLink} className="space-y-2">
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@email.com"
            className="w-full rounded-lg border-2 border-ink/20 bg-white/70 px-3 py-2 text-sm text-ink outline-none focus:border-team"
          />
          <button
            type="submit"
            disabled={status === "sending"}
            className="btn-answer btn-yes w-full text-sm disabled:opacity-50"
          >
            {status === "sending" ? "Sending…" : "Email me a magic link"}
          </button>
          {status === "error" && (
            <p className="text-xs font-semibold text-penalty">{error}</p>
          )}
        </form>
      )}
    </div>
  );
}
