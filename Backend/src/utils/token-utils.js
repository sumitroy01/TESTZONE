export const generateToken = (userId, res) => {
  const token = jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: "7d" });

  res.cookie("jwt", token, {
    maxAge: 7 * 24 * 60 * 60 * 1000,
    httpOnly: true,
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax", // none in prod for cross-site
    secure: process.env.NODE_ENV === "production", // must be true when sameSite='none'
    path: "/"
  });

  return token;
};
