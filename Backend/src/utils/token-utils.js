import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "replace_me";
const JWT_EXP_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export function generateToken(userId, res) {
  const payload = { id: String(userId) };

  const token = jwt.sign(payload, JWT_SECRET, {
    expiresIn: Math.floor(JWT_EXP_MS / 1000) + "s", // seconds
  });

  // cookie options - adjust sameSite depending on your deployment
  const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production", // true in prod
    sameSite: process.env.COOKIE_SAMESITE || "none", // "none" for cross-site (set to "lax" if same site)
    maxAge: JWT_EXP_MS,
    path: "/",
  };

  // set cookie
  res.cookie("jwt", token, cookieOptions);

  // Optionally return token (if you must support non-browser clients).
  // If you choose cookie-only for web, do NOT return the token to the browser.
  return token;
}
