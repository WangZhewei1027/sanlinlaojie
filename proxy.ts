import { updateSession } from "@/lib/supabase/proxy";
import { NextResponse, type NextRequest } from "next/server";

export async function proxy(request: NextRequest) {
  // This endpoint validates mini-program credentials itself; it has no web cookies.
  if (request.nextUrl.pathname === "/api/miniapp/anchors/recognize") {
    return NextResponse.next();
  }
  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - static assets - .svg, .png, .jpg, .jpeg, .gif, .webp, .hdr
     * Feel free to modify this pattern to include more paths.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|hdr)$).*)",
  ],
};
