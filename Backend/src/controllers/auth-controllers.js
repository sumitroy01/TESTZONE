import bcrypt from "bcrypt";
import dotenv from "dotenv";
import { generateToken } from "../utils/token-utils.js";
import { sendOtp } from "../utils/email-utils.js";
import Users from "../models/user-models.js";

dotenv.config();

const OTP_VT = 5 * 60 * 1000;
const RESEND_CD = 30 * 1000;
const SALT_ROUNDS = 10;

const genOtp = () => Math.floor(100000 + Math.random() * 900000).toString();

/* ========================= SIGNUP ========================= */
export const signUp = async (req, res) => {
  try {
    let { name, userName, email, password } = req.body;

    if (!name || !email || !password)
      return res.status(400).json({ message: "please fill all required fields" });

    email = email.trim().toLowerCase();
    userName = userName?.trim();

    if (password.length < 8)
      return res.status(400).json({ message: "password must be at least 8 characters" });

    let user = await Users.findOne({ email }).select("+otp +otpExpires +lastOtpSent");

    if (user && user.isVerified)
      return res.status(409).json({ message: "user already exists" });

    if (userName) {
      const exists = await Users.findOne({ userName });
      if (exists && (!user || exists._id.toString() !== user._id.toString()))
        return res.status(409).json({ message: "username already exists" });
    }

    if (user?.lastOtpSent && Date.now() - user.lastOtpSent.getTime() < RESEND_CD)
      return res.status(429).json({ message: "please wait before requesting otp again" });

    const otp = genOtp();
    const hashedOtp = await bcrypt.hash(otp, SALT_ROUNDS);
    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

    if (!user) {
      user = new Users({
        name,
        userName,
        email,
        password: hashedPassword,
        otp: hashedOtp,
        otpExpires: new Date(Date.now() + OTP_VT),
        lastOtpSent: new Date(),
        avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${Date.now()}`,
      });
    } else {
      user.name = name;
      user.userName = userName;
      user.password = hashedPassword;
      user.otp = hashedOtp;
      user.otpExpires = new Date(Date.now() + OTP_VT);
      user.lastOtpSent = new Date();
    }

    await user.save();
    await sendOtp(email, otp);

    return res.status(201).json({
      message: "otp sent to email",
      userId: user._id,
      email: user.email,
    });
  } catch (err) {
    console.log(err);
    return res.status(500).json({ message: "internal server error" });
  }
};

/* ========================= VERIFY USER ========================= */
export const verifyUser = async (req, res) => {
  try {
    const { email, userId, otp } = req.body;
    if ((!email && !userId) || !otp)
      return res.status(400).json({ message: "invalid request" });

    const user = userId
      ? await Users.findById(userId).select("+otp +otpExpires")
      : await Users.findOne({ email: email.toLowerCase() }).select("+otp +otpExpires");

    if (!user) return res.status(404).json({ message: "user not found" });

    if (!user.otp || Date.now() > user.otpExpires)
      return res.status(410).json({ message: "otp expired" });

    const valid = await bcrypt.compare(otp.toString(), user.otp);
    if (!valid) return res.status(422).json({ message: "invalid otp" });

    user.isVerified = true;
    user.otp = undefined;
    user.otpExpires = undefined;
    await user.save();

    generateToken(user._id, res);

    return res.status(200).json({
      message: "verified",
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        userName: user.userName,
        avatar: user.avatar,
        isVerified: user.isVerified,
      },
    });
  } catch (err) {
    return res.status(500).json({ message: "internal server error" });
  }
};

/* ========================= LOGIN ========================= */
export const logIn = async (req, res) => {
  try {
    const { identifier, password } = req.body;

    const user = await Users.findOne(
      identifier.includes("@")
        ? { email: identifier.toLowerCase() }
        : { userName: identifier }
    ).select("+password");

    if (!user) return res.status(404).json({ message: "user not found" });
    if (!user.isVerified)
      return res.status(403).json({ message: "verify account first", userId: user._id });

    const ok = await bcrypt.compare(password, user.password);
    if (!ok) return res.status(401).json({ message: "invalid credentials" });

    generateToken(user._id, res);

    return res.status(200).json({
      message: "login successful",
      user,
    });
  } catch (err) {
    return res.status(500).json({ message: "internal server error" });
  }
};

/* ========================= LOGOUT ========================= */
export const logOut = async (req, res) => {
  res.clearCookie("jwt", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  });

  return res.status(200).json({ message: "logged out" });
};

/* ========================= AUTH CHECK ========================= */
export const checkAuth = async (req, res) => {
  if (!req.user) return res.status(401).json({ message: "unauthorized" });
  return res.status(200).json(req.user);
};

/* ========================= RESET PASSWORD ========================= */
export const requestResetPassword = async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ message: "email required" });

  const user = await Users.findOne({ email: email.toLowerCase() }).select(
    "+otp +otpExpires +lastOtpSent"
  );

  if (!user) return res.status(404).json({ message: "user not found" });

  if (user.lastOtpSent && Date.now() - user.lastOtpSent.getTime() < RESEND_CD)
    return res.status(429).json({ message: "please wait" });

  const otp = genOtp();
  user.otp = await bcrypt.hash(otp, SALT_ROUNDS);
  user.otpExpires = new Date(Date.now() + OTP_VT);
  user.lastOtpSent = new Date();

  await user.save();
  await sendOtp(email, otp);

  return res.status(200).json({ message: "otp sent" });
};

export const resetPassword = async (req, res) => {
  const { email, otp, password } = req.body;

  if (!email || !otp || !password)
    return res.status(400).json({ message: "missing fields" });

  const user = await Users.findOne({ email: email.toLowerCase() }).select(
    "+otp +otpExpires +password"
  );

  if (!user || !user.otp || Date.now() > user.otpExpires)
    return res.status(422).json({ message: "invalid or expired otp" });

  const valid = await bcrypt.compare(otp, user.otp);
  if (!valid) return res.status(422).json({ message: "invalid otp" });

  user.password = await bcrypt.hash(password, SALT_ROUNDS);
  user.otp = undefined;
  user.otpExpires = undefined;

  await user.save();
  res.clearCookie("jwt");

  return res.status(200).json({ message: "password reset successful" });
};

/* ========================= RESEND RESET OTP ========================= */
export const resendResetOtp = async (req, res) => {
  const { email } = req.body;

  const user = await Users.findOne({ email: email.toLowerCase() }).select(
    "+otp +otpExpires +lastOtpSent"
  );

  if (!user) return res.status(404).json({ message: "user not found" });

  if (user.lastOtpSent && Date.now() - user.lastOtpSent.getTime() < RESEND_CD)
    return res.status(429).json({ message: "wait before retrying" });

  const otp = genOtp();
  user.otp = await bcrypt.hash(otp, SALT_ROUNDS);
  user.otpExpires = new Date(Date.now() + OTP_VT);
  user.lastOtpSent = new Date();

  await user.save();
  await sendOtp(user.email, otp);

  return res.status(200).json({ message: "otp resent" });
};

/* ========================= RESEND SIGNUP OTP ========================= */
export const resendOtp = async (req, res) => {
  const { userId } = req.body;

  const user = await Users.findById(userId).select("+otp +otpExpires +lastOtpSent");
  if (!user) return res.status(404).json({ message: "user not found" });

  if (user.lastOtpSent && Date.now() - user.lastOtpSent.getTime() < RESEND_CD)
    return res.status(429).json({ message: "wait before retrying" });

  const otp = genOtp();
  user.otp = await bcrypt.hash(otp, SALT_ROUNDS);
  user.otpExpires = new Date(Date.now() + OTP_VT);
  user.lastOtpSent = new Date();

  await user.save();
  await sendOtp(user.email, otp);

  return res.status(200).json({ message: "otp resent" });
};
