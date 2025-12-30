import express from "express";
import {
  logIn,
  signUp,
  checkAuth,
  logOut,
  requestResetPassword,
  resetPassword,
  verifyUser,
  resendResetOtp,
  resendOtp,
} from "../controllers/auth-controllers.js";
import { protectRoute } from "../middleware/auth-middleware.js";

const router = express.Router();

router.post("/signup", signUp);
router.post("/login", logIn);
router.post("/logout", protectRoute, logOut);
router.get("/check", protectRoute, checkAuth);

router.post("/verify-user", verifyUser);
router.post("/resend-otp", resendOtp);

router.post("/password/request-reset", requestResetPassword);
router.post("/password/reset", resetPassword);
router.post("/password/resend-otp", resendResetOtp);

export default router;
