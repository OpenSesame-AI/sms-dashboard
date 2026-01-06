import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const isPublicRoute = createRouteMatcher([
  "/c/:path*",
]);

/**
 * Detect if the request is from a WebView (in-app browser)
 * This can be used server-side to set headers or cookies
 */
function isWebViewRequest(userAgent: string | null): boolean {
  if (!userAgent) return false;

  const ua = userAgent.toLowerCase();
  
  // LinkedIn in-app browser
  if (ua.includes('linkedinapp')) return true;
  
  // Facebook in-app browser
  if (ua.includes('fban') || ua.includes('fbav')) return true;
  
  // Instagram in-app browser
  if (ua.includes('instagram')) return true;
  
  // Twitter/X in-app browser
  if (ua.includes('twitter')) return true;
  
  // Generic Android WebView (wv indicates WebView)
  if (ua.includes('wv') && !ua.includes('chrome')) return true;
  
  // iOS WebView detection (no Safari in user agent but has Mobile)
  if (
    /iphone|ipad|ipod/.test(ua) &&
    ua.includes('mobile') &&
    !ua.includes('safari')
  ) {
    return true;
  }
  
  // Additional check: if it's mobile but doesn't have standard browser indicators
  const isMobile = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(ua);
  const hasStandardBrowser = ua.includes('chrome') || ua.includes('safari') || ua.includes('firefox');
  
  if (isMobile && !hasStandardBrowser) {
    return true;
  }

  return false;
}

export default clerkMiddleware(async (auth, req) => {
  // Detect WebView and set a header for client-side use
  const userAgent = req.headers.get("user-agent");
  const isWebView = isWebViewRequest(userAgent);
  
  // Create response
  const response = NextResponse.next();
  
  // Set a header to indicate WebView (can be read client-side)
  if (isWebView) {
    response.headers.set("x-webview", "true");
  }
  
  // Apply authentication protection
  if (!isPublicRoute(req)) {
    await auth.protect();
  }
  
  return response;
});

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    "/((?!_next|[^?]*\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};

