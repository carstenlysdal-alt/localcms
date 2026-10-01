import { NextResponse, type NextRequest } from "next/server";
import { ALL_NETWORK_SITES, siteOrigin, resolveSwitchPath } from "@/lib/network-sites";

/**
 * Bagudkompatibel byskifte-rute. Selve byskifteren bruger nu almindelige links til
 * målbyens domæne; denne rute findes kun, så gamle links/bogmærker ikke giver 404.
 *
 * Sikkerhed: målet kan KUN være en by fra ALL_NETWORK_SITES (hvidliste), stien skal være
 * en relativ sti på samme site ("/…", aldrig "//" eller "http…"), og der sættes ingen cookie.
 */
export function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const requested = (searchParams.get("site") ?? "").toLowerCase().trim();
  const target = ALL_NETWORK_SITES.find(
    (s) => s.domaene === requested || s.navn.toLowerCase() === requested || localName(s.domaene) === requested,
  );

  if (!target) {
    return new NextResponse(null, { status: 307, headers: { Location: "/" } });
  }

  const rawPath = searchParams.get("redirect") ?? "/";
  const safePath = isSafeRelativePath(rawPath) ? resolveSwitchPath(rawPath.split("?")[0].split("#")[0]) : "/";

  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  const origin = siteOrigin(target.domaene, host, request.headers.get("x-forwarded-proto"));
  return NextResponse.redirect(`${origin}${safePath}`, 307);
}

function localName(domaene: string) {
  return domaene.replace(/\.dk$/i, "");
}

function isSafeRelativePath(path: string): boolean {
  return path.startsWith("/") && !path.startsWith("//") && !path.includes("\\") && !/[\r\n]/.test(path);
}
