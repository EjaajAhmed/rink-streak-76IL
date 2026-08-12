import { NextResponse } from "next/server";
import { getServerSupabase } from "../../lib/supabase/server";

// OAuth / magic-link redirect target. Exchanges the `code` for a session, then
// sends the user back where they started (?next=), defaulting to home.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") ?? "/";

  if (code) {
    const supabase = getServerSupabase();
    if (supabase) {
      await supabase.auth.exchangeCodeForSession(code);
    }
  }
  return NextResponse.redirect(new URL(next, url.origin));
}
