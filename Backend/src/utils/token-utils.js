import jwt from "jsonwebtoken";

export const generateToken = (userId, res) => {
  const token = jwt.sign(
    { userId },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );


  const isProd =
    process.env.NODE_ENV === "production" &&
    process.env.FORCE_HTTPS === "true";

  res.cookie("jwt", token, {
    httpOnly: true,
    secure: isProd,                 // false in KIND
    sameSite: isProd ? "none" : "lax",
    path: "/",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });

  return token;
};
