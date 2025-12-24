import { create } from "zustand";
import { axiosInstance } from "../lib/axios";
import toast from "react-hot-toast";

const authStore = create((set, get) => ({
  authUser: null,
  isSigningUp: false,
  isLogginIn: false,
  isCheckingAuth: true,
  isResettingPass: false,
  isLogginOut: false,
  verficationPendingId: null,

  
  checkAuth: async () => {
    try {
      const res = await axiosInstance.get("/api/auth/check");
      set({ authUser: res.data });
    } catch {
      set({ authUser: null });
    } finally {
      set({ isCheckingAuth: false });
    }
  },

  signUp: async (data) => {
    set({ isSigningUp: true });
    try {
      const res = await axiosInstance.post("/api/auth/signup", data);
      set({ verficationPendingId: res.data.userId });
      toast.success(res.data.message);
      return { success: true };
    } catch (error) {
      toast.error(error?.response?.data?.message || "signup failed");
      return { success: false };
    } finally {
      set({ isSigningUp: false });
    }
  },

  verifyUser: async (otp) => {
    const { verficationPendingId, checkAuth } = get();

    if (!verficationPendingId) {
      toast.error("invalid user. please signup again");
      return { success: false };
    }

    try {
      await axiosInstance.post("/api/auth/verify-user", {
        userId: verficationPendingId,
        otp,
      });

      set({ verficationPendingId: null });

      // 🔑 TRUST BACKEND, NOT RESPONSE
      await checkAuth();

      toast.success("account verified successfully");
      return { success: true };
    } catch (error) {
      toast.error(error?.response?.data?.message || "invalid otp");
      return { success: false };
    }
  },

  logIn: async ({ identifier, password }) => {
    set({ isLogginIn: true });
    try {
      await axiosInstance.post("/api/auth/login", {
        identifier,
        password,
      });

      // 🔑 DO NOT SET authUser HERE
      await get().checkAuth();

      toast.success("logged in successfully");
      return { success: true };
    } catch (error) {
      const data = error?.response?.data;

      if (data?.needsVerification && data?.userId) {
        set({ verficationPendingId: data.userId });
        toast.error(data.message);
        return { success: false, needsVerification: true };
      }

      toast.error(data?.message || "login failed");
      return { success: false };
    } finally {
      set({ isLogginIn: false });
    }
  },

  logOut: async () => {
    set({ isLogginOut: true });
    try {
      await axiosInstance.post("/api/auth/logout");
      set({ authUser: null });
      toast.success("logged out successfully");
    } catch (error) {
      toast.error("logout failed");
    } finally {
      set({ isLogginOut: false });
    }
  },
}));

export default authStore;
