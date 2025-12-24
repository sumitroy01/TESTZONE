import nodemailer from "nodemailer";
import dotenv from "dotenv";
dotenv.config();

const GMAIL_USER = process.env.GMAIL_USER;
const GMAIL_APP_PASSWORD = process.env.GMAIL_APP_PASSWORD;

const FROM =
  process.env.EMAIL_FROM ||
  `SRM@apps20 <${GMAIL_USER}>`;

if (!GMAIL_USER || !GMAIL_APP_PASSWORD) {
  console.warn("⚠️ Gmail SMTP env not set — emails will fail until configured.");
}

const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 587,
  secure: false,
  auth: {
    user: GMAIL_USER,
    pass: GMAIL_APP_PASSWORD,
  },
});

console.log("✅ Gmail SMTP initialized");

export async function sendOtp(to, otp) {
  if (!GMAIL_USER || !GMAIL_APP_PASSWORD)
    throw new Error("GMAIL SMTP credentials missing");

  const msg = {
    from: FROM,
    to,
    subject: "Your YapYap Verification code",
    text: `Your OTP is ${otp}. It will expire in 5 minutes.`,
    html: `
      <div style="font-family:sans-serif;line-height:1.5">
        <h2>Welcome to YapYap :🗣️</h2>
        <p>Your OTP is:</p>
        <h1 style="color:#007bff;">${otp}</h1>
        <p>This code expires in <strong>5 minutes</strong>.</p>
        <br/>
        <p>If you didn’t request this, you can safely ignore this email.</p>
      </div>
    `,
  };

  try {
    const res = await transporter.sendMail(msg);
    console.log(`✅ OTP email sent to ${to} [id ${res.messageId}]`);
    return res;
  } catch (error) {
    console.error(`❌ Gmail SMTP send error for ${to}:`, error.message);
    throw new Error("Failed to send OTP email");
  }
}

export async function sendGenericEmail({ to, subject, text, html }) {
  if (!GMAIL_USER || !GMAIL_APP_PASSWORD)
    throw new Error("GMAIL SMTP credentials missing");

  const msg = {
    from: FROM,
    to,
    subject,
    text,
    html: html || `<p>${text}</p>`,
  };

  try {
    const res = await transporter.sendMail(msg);
    console.log(`✅ Generic email sent to ${to} [id ${res.messageId}]`);
    return res;
  } catch (error) {
    console.error(`❌ Gmail SMTP generic send error for ${to}:`, error.message);
    throw new Error("Failed to send email");
  }
}

export default { sendOtp, sendGenericEmail };
