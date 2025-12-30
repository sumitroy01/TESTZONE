import { useState, useEffect } from "react";
import { motion } from "framer-motion";

function ResetPasswordForm({
  resetPass,
  resendOtppass,
  isResettingPass,
  initialEmail,
  onSuccess,
  onBackToLogin,
  showBack,
  onBackToLanding,
}) {
  const [form, setForm] = useState({
    email: initialEmail || "",
    otp: "",
    password: "",
  });

  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (initialEmail) {
      setForm((prev) => ({ ...prev, email: initialEmail }));
    }
  }, [initialEmail]);

  useEffect(() => {
    if (cooldown <= 0) return;

    const timer = setInterval(() => {
      setCooldown((c) => c - 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [cooldown]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!form.email || !form.otp || !form.password) return;

    const res = await resetPass({
      email: form.email,
      otp: form.otp,
      password: form.password,
    });

    if (res?.success) {
      setForm({ email: "", otp: "", password: "" });
      onSuccess();
    }
  };

  const handleResend = async () => {
    if (!form.email) return;

    const res = await resendOtppass({ email: form.email });
    if (res?.success) setCooldown(30);
  };

  return (
    <motion.form
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      transition={{ duration: 0.2 }}
      onSubmit={handleSubmit}
      className="space-y-3 text-sm"
    >
      <div>
        <label className="text-[11px] text-neutral-400">Email</label>
        <input
          className="mt-1 w-full bg-white/5 rounded-xl px-3 py-2 outline-none focus:ring-1 focus:ring-sky-500/60"
          value={form.email}
          onChange={(e) =>
            setForm((prev) => ({ ...prev, email: e.target.value }))
          }
          type="email"
        />
      </div>

      <div>
        <label className="text-[11px] text-neutral-400">OTP</label>
        <input
          className="mt-1 w-full bg-white/5 rounded-xl px-3 py-2 outline-none focus:ring-1 focus:ring-sky-500/60"
          value={form.otp}
          onChange={(e) =>
            setForm((prev) => ({ ...prev, otp: e.target.value }))
          }
        />
      </div>

      <div>
        <label className="text-[11px] text-neutral-400">New password</label>
        <input
          type="password"
          className="mt-1 w-full bg-white/5 rounded-xl px-3 py-2 outline-none focus:ring-1 focus:ring-sky-500/60"
          value={form.password}
          onChange={(e) =>
            setForm((prev) => ({ ...prev, password: e.target.value }))
          }
        />
      </div>

      <p className="text-[11px] text-neutral-400">
        Didn’t receive the OTP? Check spam or resend.
      </p>

      <button
        type="button"
        onClick={handleResend}
        disabled={cooldown > 0}
        className="text-[11px] text-sky-400 hover:text-sky-300 disabled:text-neutral-500"
      >
        {cooldown > 0 ? `Resend OTP in ${cooldown}s` : "Resend OTP"}
      </button>

      <button
        type="submit"
        disabled={isResettingPass}
        className="w-full mt-2 px-3 py-2 rounded-xl bg-sky-500 hover:bg-sky-400 text-xs font-semibold text-slate-950 disabled:opacity-60"
      >
        {isResettingPass ? "Resetting..." : "Reset password"}
      </button>

      <button
        type="button"
        className="w-full text-[11px] text-neutral-400 hover:text-neutral-200 mt-1"
        onClick={onBackToLogin}
      >
        Back to login
      </button>

      {showBack && (
        <button
          type="button"
          className="mt-2 w-full text-[11px] text-neutral-400 hover:text-neutral-200"
          onClick={onBackToLanding}
        >
          Back to home
        </button>
      )}
    </motion.form>
  );
}

export default ResetPasswordForm;
