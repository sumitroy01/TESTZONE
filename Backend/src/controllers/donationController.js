import razorpay from "../config/razorpay.js";
import crypto from "crypto";
import Profile from "../models/profile.models.js";

// ✅ Create Razorpay Order
export const createOrder = async (req, res) => {
  try {
    const { profileId, amount } = req.body || {};

    // Basic validation
    const amt = Number(amount);
    if (!profileId) return res.status(400).json({ error: "profileId is required" });
    if (!Number.isFinite(amt) || amt <= 0) return res.status(400).json({ error: "amount must be a positive number (in INR)" });

    const options = {
      amount: Math.round(amt * 100), // amount in paise
      currency: "INR",
      receipt: `receipt_${Date.now()}`,
      notes: { profileId },
    };

    const order = await razorpay.orders.create(options);

    return res.json({ orderId: order.id, key: process.env.RAZORPAY_KEY_ID });
  } catch (err) {
    console.error("[createOrder] Error:", err);
    return res.status(500).json({ error: "Something went wrong" });
  }
};

// ✅ Verify Payment, increment donatedAmount, and flip goalMet when reached
// export const verifyPayment = async (req, res) => {
//   try {
//     const {
//       razorpay_order_id,
//       razorpay_payment_id,
//       razorpay_signature,
//       profileId,
//       amount,
//     } = req.body || {};

//     if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
//       return res.status(400).json({ success: false, message: "Missing Razorpay verification fields" });
//     }
//     if (!profileId) {
//       return res.status(400).json({ success: false, message: "profileId is required" });
//     }

//     // Verify signature
//     const body = `${razorpay_order_id}|${razorpay_payment_id}`;
//     const expectedSignature = crypto
//       .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
//       .update(body)
//       .digest("hex");

//     if (expectedSignature !== razorpay_signature) {
//       return res.status(400).json({ success: false, message: "Invalid signature" });
//     }

//     // Signature valid → record donation
//     const amt = Number(amount) || 0; // amount expected in INR (not paise)

//     // increment and get updated doc
//     const updated = await Profile.findByIdAndUpdate(
//       profileId,
//       { $inc: { donatedAmount: amt } },
//       { new: true }
//     );

//     if (!updated) {
//       return res.status(404).json({ success: false, message: "Profile not found" });
//     }

//     // if goal reached and not already marked, set goalMet
//     if (!updated.goalMet && Number(updated.donatedAmount) >= Number(updated.donationGoal)) {
//       updated.goalMet = true;
//       updated.goalMetAt = new Date();
//       await updated.save();
//     }

//     return res.json({ success: true, message: "Payment verified & donation recorded", profile: updated });
//   } catch (err) {
//     console.error("[verifyPayment] Error:", err);
//     return res.status(500).json({ error: "Payment verification failed" });
//   }
// };
export const verifyPayment = async (req, res) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      profileId,
      amount,
    } = req.body || {};

    // Optional: basic validation
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      console.warn("Missing Razorpay verification fields (test mode). Redirecting home.");
      return res.redirect("/"); // always redirect to home in test mode
    }

    // Signature verification (skipped error throwing in test mode)
    const body = `${razorpay_order_id}|${razorpay_payment_id}`;
    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(body)
      .digest("hex");

    if (expectedSignature === razorpay_signature) {
      // ✅ Signature valid — record donation
      const amt = Number(amount) || 0;
      if (profileId && amt > 0) {
        const updated = await Profile.findByIdAndUpdate(
          profileId,
          { $inc: { donatedAmount: amt } },
          { new: true }
        );

        if (updated && !updated.goalMet && updated.donatedAmount >= updated.donationGoal) {
          updated.goalMet = true;
          updated.goalMetAt = new Date();
          await updated.save();
        }
      }
    } else {
      console.warn("Invalid signature (test mode). Still redirecting home.");
    }

    // 🎯 Redirect to home no matter what (success/failure)
    return res.redirect("/");
  } catch (err) {
    console.error("[verifyPayment] Error:", err);
    // Redirect home even on error
    return res.redirect("/");
  }
};
