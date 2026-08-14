import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PATHS = ["/login", "/signup", "/join-test-org", "/api/leads/intake", "/test-intake"];

// Renamed from middleware.ts per Next.js 16: proxy.ts always runs on the
// Node.js runtime (never Edge). This matters here specifically because
// Vercel does not expose "Sensitive" environment variables to the Edge
// runtime — only to Node.js functions — which was the root cause of the
// MIDDLEWARE_INVOCATION_FAILED crash under the old middleware.ts/Edge setup.
export async function proxy(request: NextRequest) {
  try {
    let response = NextResponse.next({ request });

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
            response = NextResponse.next({ request });
            cookiesToSet.forEach(({ name, value, options }) =>
              response.cookies.set(name, value, options)
            );
          },
        },
      }
    );

    const {
      data: { user },
    } = await supabase.auth.getUser();

    const isPublic = PUBLIC_PATHS.some((p) => request.nextUrl.pathname.startsWith(p));

    if (!user && !isPublic) {
      const loginUrl = request.nextUrl.clone();
      loginUrl.pathname = "/login";
      return NextResponse.redirect(loginUrl);
    }

    return response;
  } catch (err) {
    console.error("Proxy error:", err);
    return NextResponse.next({ request });
  }
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
