// src/store/message.store.js
import { create } from "zustand";
import { axiosInstance } from "../lib/axios";
import toast from "react-hot-toast";

/* ---------- helpers ---------- */

const handleAuthError = (error) => {
  if (error?.response?.status === 401) {
    toast.error("Session expired. Please login again.");
    return true;
  }
  return false;
};

const sortMessagesAsc = (msgs = []) =>
  [...msgs].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );

/* ---------- store ---------- */

const messageStore = create((set, get) => ({
  messagesByChat: {},

  isSendingMessage: false,
  isFetchingMessages: false,
  isMarkingRead: false,
  isDeletingMessage: false,
  isDeletingChat: false,

  /* ---------- fetch messages ---------- */

  fetchMessages: async ({ chatId, page = 1, limit = 50, sort = "asc" }) => {
    if (!chatId) return { success: false };

    set({ isFetchingMessages: true });
    try {
      const res = await axiosInstance.get(`/api/message/${chatId}`, {
        params: { page, limit, sort },
      });

      const { data, page: resPage, limit: resLimit } = res.data || {};
      const hasMore = Array.isArray(data) && data.length === resLimit;

      set((state) => {
        const existing = state.messagesByChat[chatId] || { data: [] };
        const merged =
          resPage === 1 ? data || [] : [...existing.data, ...(data || [])];

        return {
          messagesByChat: {
            ...state.messagesByChat,
            [chatId]: {
              data: sortMessagesAsc(merged),
              page: resPage,
              limit: resLimit,
              hasMore,
            },
          },
        };
      });

      return { success: true };
    } catch (error) {
      if (handleAuthError(error)) return { success: false };
      toast.error(
        error?.response?.data?.message || "could not fetch messages"
      );
      return { success: false };
    } finally {
      set({ isFetchingMessages: false });
    }
  },

  /* ---------- send message ---------- */

  sendMessage: async (payload) => {
    const chatId =
      payload instanceof FormData ? payload.get("chatId") : payload?.chatId;

    if (!chatId) {
      toast.error("chatId is required");
      return { success: false };
    }

    set({ isSendingMessage: true });
    try {
      const config =
        payload instanceof FormData
          ? { headers: { "Content-Type": "multipart/form-data" } }
          : undefined;

      const res = await axiosInstance.post("/api/message", payload, config);
      const newMessage = res.data;

      set((state) => {
        const existing = state.messagesByChat[chatId] || {
          data: [],
          page: 1,
          limit: 50,
          hasMore: true,
        };

        const exists = existing.data.some(
          (m) =>
            String(m._id) === String(newMessage._id) ||
            (m.clientId && newMessage.clientId && m.clientId === newMessage.clientId)
        );

        const updated = exists
          ? existing.data.map((m) =>
              String(m._id) === String(newMessage._id)
                ? { ...m, ...newMessage }
                : m
            )
          : [...existing.data, newMessage];

        return {
          messagesByChat: {
            ...state.messagesByChat,
            [chatId]: { ...existing, data: sortMessagesAsc(updated) },
          },
        };
      });

      return { success: true };
    } catch (error) {
      if (handleAuthError(error)) return { success: false };
      toast.error(
        error?.response?.data?.message || "could not send message"
      );
      return { success: false };
    } finally {
      set({ isSendingMessage: false });
    }
  },

  /* ---------- mark as read ---------- */

  markAsRead: async ({ chatId, messageId, userId, silent = false }) => {
    if (!chatId && !messageId) return { success: false };

    set({ isMarkingRead: true });
    try {
      await axiosInstance.put("/api/message/read", {
        chatId,
        messageId,
      });

      set((state) => {
        const updated = { ...state.messagesByChat };

        Object.values(updated).forEach((entry) => {
          if (!entry?.data) return;
          entry.data = entry.data.map((msg) =>
            String(msg._id) === String(messageId) && userId
              ? { ...msg, readBy: [...(msg.readBy || []), userId] }
              : msg
          );
        });

        return { messagesByChat: updated };
      });

      if (!silent) toast.success("marked as read");
      return { success: true };
    } catch (error) {
      if (handleAuthError(error)) return { success: false };
      if (!silent) toast.error("could not mark as read");
      return { success: false };
    } finally {
      set({ isMarkingRead: false });
    }
  },

  /* ---------- delete message ---------- */

  deleteMessage: async ({ messageId, chatId }) => {
    if (!messageId) return { success: false };

    set({ isDeletingMessage: true });
    try {
      await axiosInstance.delete(`/api/message/${messageId}`);

      set((state) => {
        const updated = { ...state.messagesByChat };
        const entry = updated[chatId];
        if (entry?.data) {
          entry.data = entry.data.filter(
            (m) => String(m._id) !== String(messageId)
          );
        }
        return { messagesByChat: updated };
      });

      toast.success("message deleted");
      return { success: true };
    } catch (error) {
      if (handleAuthError(error)) return { success: false };
      toast.error("could not delete message");
      return { success: false };
    } finally {
      set({ isDeletingMessage: false });
    }
  },

  /* ---------- delete chat ---------- */

  deleteChat: async (chatId) => {
    if (!chatId) return { success: false };

    set({ isDeletingChat: true });
    try {
      await axiosInstance.delete(`/api/message/chat/${chatId}`);
      set((state) => {
        const updated = { ...state.messagesByChat };
        delete updated[chatId];
        return { messagesByChat: updated };
      });

      toast.success("chat deleted");
      return { success: true };
    } catch (error) {
      if (handleAuthError(error)) return { success: false };
      toast.error("could not delete chat");
      return { success: false };
    } finally {
      set({ isDeletingChat: false });
    }
  },

  /* ---------- socket helpers ---------- */

  addIncomingMessage: (chatId, incomingMessage) => {
    if (!chatId || !incomingMessage) return;

    set((state) => {
      const existing = state.messagesByChat[chatId] || {
        data: [],
        page: 1,
        limit: 50,
        hasMore: true,
      };

      const exists = existing.data.some(
        (m) =>
          String(m._id) === String(incomingMessage._id) ||
          (m.clientId &&
            incomingMessage.clientId &&
            m.clientId === incomingMessage.clientId)
      );

      const updated = exists
        ? existing.data.map((m) =>
            String(m._id) === String(incomingMessage._id)
              ? { ...m, ...incomingMessage }
              : m
          )
        : [...existing.data, incomingMessage];

      return {
        messagesByChat: {
          ...state.messagesByChat,
          [chatId]: { ...existing, data: sortMessagesAsc(updated) },
        },
      };
    });
  },

  clearMessagesForChat: (chatId) => {
    if (!chatId) return;
    set((state) => {
      const updated = { ...state.messagesByChat };
      delete updated[chatId];
      return { messagesByChat: updated };
    });
  },

  clearAllMessages: () => {
    set({ messagesByChat: {} });
  },
}));

export default messageStore;
