import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";
import { isPublicWebsiteEnabled } from "@/lib/public-site-switch";

const publicWebsiteRoots = [
  "/products",
  "/categories",
  "/about",
  "/branches",
  "/contact",
  "/basket",
  "/checkout",
  "/quote",
  "/privacy",
];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isPublicWebsiteRoute =
    pathname === "/" ||
    publicWebsiteRoots.some(
      (root) => pathname === root || pathname.startsWith(`${root}/`),
    );

  if (!isPublicWebsiteEnabled() && isPublicWebsiteRoute) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  return updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
