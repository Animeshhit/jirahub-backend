import rateLimit from "express-rate-limit";

export const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 100, // 100 requests per IP per window
  standardHeaders: true, // sends RateLimit-* headers
  legacyHeaders: false, // disables deprecated X-RateLimit-* headers
  message: { message: "Too many requests, please try again later." },
});

/**
 * Stricter limiter for auth routes — login/register are the most
 * common brute-force / credential-stuffing targets.
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5, // only 5 attempts per IP per window
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // don't count successful logins against the limit
  message: { message: "Too many attempts. Please try again in 15 minutes." },
});

/**
 * Slightly looser limiter for the refresh endpoint — legitimate
 * clients call this automatically, so it needs more headroom than login.
 */
export const refreshLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many refresh attempts, please try again later." },
});