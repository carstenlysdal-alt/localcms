import { NextResponse, type NextRequest } from "next/server";
import { legacyPathToAscii } from "@/lib/slug";

/**
 * 1) /redaktion/** kræver session-cookie (ellers redirect til /login).
 * 2) Ældre URL'er med rå/percent-kodede æ/ø/å i stien 301-omdirigeres til den
 *    translittererede ASCII-slug (fx /nyheder/døgnrapport-… -> /nyheder/doegnrapport-…).
 *
 * /partner/* er BEVIDST offentlig: sponsorer åbner deres side via token-link uden login.
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname === "/redaktion" || pathname.startsWith("/redaktion/")) {
    const hasSession = Boolean(
      request.cookies.get("authjs.session-token") ??
        request.cookies.get("__Secure-authjs.session-token"),
    );
    if (!hasSession) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("callbackUrl", pathname);
      return NextResponse.redirect(loginUrl);
    }
    return NextResponse.next();
  }

  const ascii = legacyPathToAscii(pathname);
  if (ascii) {
    const url = request.nextUrl.clone();
    url.pathname = ascii;
    return NextResponse.redirect(url, 301);
  }

  return NextResponse.next();
}

export const config = {
  // Matcher alt undtagen interne filer og statiske ressourcer. /partner/* er ikke beskyttet.
  matcher: ["/((?!_next/|api/|favicon.ico|media/|avatars/|uploads/).*)"],
};
