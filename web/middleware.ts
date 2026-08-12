import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

type CookieToSet = { name: string; value: string; options: CookieOptions };

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

// Refresh the Supabase auth session cookie on navigation so server components
// see a fresh session. No-op passthrough when Supabase isn't configured, so the
// guest-only build is completely unaffected.
export async function middleware(request: NextRequest) {
  if (!URL || !KEY) return NextResponse.next();

  let response = NextResponse.next({ request });

  const supabase = createServerClient(URL, KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: CookieToSet[]) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value),
        );
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  // Touch the session so the cookie is refreshed if needed.
  await supabase.auth.getUser();
  return response;
}

export const config = {
  // Run on app routes but skip static assets, the dataset, and images.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|players.json|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
