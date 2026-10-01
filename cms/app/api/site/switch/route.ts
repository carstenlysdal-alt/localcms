import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const targetSite = searchParams.get("site");
  const redirectPath = searchParams.get("redirect") || "/";

  if (!targetSite) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  const siteClean = targetSite.toLowerCase().trim();
  const instance = await db.instance.findFirst({
    where: {
      OR: [
        { domaene: siteClean },
        { id: siteClean },
        { navn: { equals: siteClean } },
      ],
    },
  });

  const redirectUrl = new URL(redirectPath, request.url);
  const response = NextResponse.redirect(redirectUrl);

  if (instance) {
    response.cookies.set("site", instance.domaene, {
      path: "/",
      maxAge: 60 * 60 * 24 * 30, // 30 dage
      sameSite: "lax",
    });
  }

  return response;
}
