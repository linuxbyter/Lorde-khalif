// middleware.ts
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

// Define public routes
const isPublicRoute = createRouteMatcher([
  '/', 
  '/sign-in(.*)', 
  '/sign-up(.*)', 
  '/api/user/connect-deriv',
  '/api/bot/(.*)' // ✅ This opens up /api/bot/execute, /api/bot/start, and /api/bot/stop
]);

export default clerkMiddleware(async (auth, request) => {
  // If the route is not public, protect it
  if (!isPublicRoute(request)) {
    const { protect } = await auth();
    await protect();
  }
}, { debug: true });

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
    // ALWAYS run for Clerk internal frontend API routes (CRITICAL)
    '/__clerk/(.*)',
  ],
};
