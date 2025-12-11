import Users from "../models/user-models.js";
import jwt from "jsonwebtoken";
export const protectRoute = async (req, res, next) => {
  try {
    const token = req.cookies?.jwt || req.headers.authorization?.split(" ")[1];

    if (!token) {
      return res.status(401).json({ message: "No user credentials found!! please login/signup" });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (error) {
      console.error("JWT verify error:", error.message);
      // don't clear cookie here; let client decide on logout flow
      return res.status(401).json({ message: "Invalid or expired token" });
    }

    const user = await Users.findById(decoded.userId).select("-password");

    if (!user) {
      return res.status(401).json({ message: "user not found!! please create a new account" });
    }

    req.user = user;
    next();
  } catch (error) {
    console.log("error in auth-middleware", error.message);
    return res.status(500).json({ message: "internal server error" });
  }
};
