import { authMiddleware } from "@clerk/nextjs";

export default authMiddleware({
  // Public routes that don't require logging in
  publicRoutes: ["/", "/sign-in(.*)", "/sign-up(.*)", "/api/user/connect-deriv"],
});

export const config = {
  matcher: ["/((?!.+\\.[\\w]+$|_next).*)", "/", "/(api|trpc)(.*)"],
};
