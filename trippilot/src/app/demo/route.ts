import { NextResponse } from "next/server";
import { DEMO_COOKIE } from "@/lib/config";

/** Enter demo mode: sets a cookie and opens the app with sample data. */
export async function GET(request: Request) {
  const url = new URL("/app", request.url);
  const res = NextResponse.redirect(url);
  res.cookies.set(DEMO_COOKIE, "1", { path: "/", maxAge: 60 * 60 * 24 * 30, sameSite: "lax" });
  return res;
}
