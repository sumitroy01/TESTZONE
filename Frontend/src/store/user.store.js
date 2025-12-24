// src/store/user.store.js
import { create } from "zustand";
import { axiosInstance } from "../lib/axios";
import toast from "react-hot-toast";

const userstore = create((set) => ({
  userFound: null,
  isUpdatingProfile: false,
  isUpdatingEmail: false,
  isSearchingUser: false,

  findUser: async (userName) => {
    const value = userName && userName.trim();
    if (!value) return;

    set({ isSearchingUser: true, userFound: null });

    try {
      const res = await axiosInstance.get("/api/user/get/user", {
        params: { userName: value },
      });
      set({ userFound: res.data?.user ?? res.data ?? null });
    } catch (error) {
      toast.error(
        error?.response?.data?.message ||
          error.message ||
          "failed to search user"
      );
      set({ userFound: null });
    } finally {
      set({ isSearchingUser: false });
    }
  },

  updateProfile: async ({ name, userName, avatar, avatarFile }) => {
    set({ isUpdatingProfile: true });

    try {
      const formData = new FormData();
      if (name !== undefined) formData.append("name", name);
      if (userName !== undefined) formData.append("userName", userName);
      if (avatarFile) formData.append("avatar", avatarFile);
      else if (avatar) formData.append("avatar", avatar);

      await axiosInstance.post("/api/user/update-profile", formData);

      toast.success("profile updated successfully");
      return { success: true };
    } catch (error) {
      toast.error(error?.response?.data?.message);
      return { success: false };
    } finally {
      set({ isUpdatingProfile: false });
    }
  },

  requestEmailUpdate: async ({ email, password }) => {
    set({ isUpdatingEmail: true });
    try {
      await axiosInstance.post("/api/user/email/change/request", {
        email,
        password,
      });
      toast.success("OTP sent to your new email");
      return { success: true };
    } catch (error) {
      toast.error(error?.response?.data?.message);
      return { success: false };
    } finally {
      set({ isUpdatingEmail: false });
    }
  },

  updateEmail: async (otp) => {
    try {
      await axiosInstance.post("/api/user/email/change/confirm", { otp });
      toast.success("Email updated successfully");
      return { success: true };
    } catch (error) {
      toast.error("Invalid or expired OTP");
      return { success: false };
    }
  },

  requestDeleteAccount: async (password) => {
    try {
      await axiosInstance.post("/api/user/delete-account/request", {
        password,
      });
      toast.success("OTP sent to your email");
      return { success: true };
    } catch (error) {
      toast.error(
        error?.response?.data?.message ||
          error.message ||
          "failed to request delete"
      );
      return { success: false };
    }
  },

  confirmDeleteAccount: async (otp) => {
    try {
      await axiosInstance.post("/api/user/delete-account/confirm", { otp });
      toast.success("Account deleted successfully");
      setTimeout(() => {
        window.location.href = "/";
      }, 500);
      return { success: true };
    } catch (error) {
      toast.error(
        error?.response?.data?.message ||
          error.message ||
          "failed to delete account"
      );
      return { success: false };
    }
  },

  resendEmailOtp: async () => {
    try {
      await axiosInstance.post("/api/user/email/change/resend");
      toast.success("OTP resent to your email");
    } catch {
      toast.error("please try later");
    }
  },
}));

export default userstore;
