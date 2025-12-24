import { create } from "zustand";
import { axiosInstance } from "../lib/axios";
import toast from "react-hot-toast";
import { getSocket, markJoinedRoom, markLeftRoom } from "../socket.js";

/* ---------- helpers ---------- */

const handleAuthError = (error) => {
  if (error?.response?.status === 401) {
    toast.error("Session expired. Please login again.");
    return true; // auth error handled
  }
  return false;
};

const normalizeChat = (chat) => {
  if (!chat) return chat;

  const isGroupChat = chat.isGroupChat ?? !!chat.isGroup;
  const users = chat.users || chat.allUsers || [];
  const chatName =
    chat.chatName ||
    chat.groupName ||
    (isGroupChat ? "Group chat" : chat.chatName);

  return {
    ...chat,
    isGroupChat,
    users,
    chatName,
  };
};

/* ---------- store ---------- */

const chatstore = create((set, get) => ({
  chats: [],
  selectedChat: null,

  isFetchingChats: false,
  isAccessingChat: false,
  isCreatingGroup: false,
  isRenamingGroup: false,
  isUpdatingGroup: false,
  isDeletingChat: false,

  page: 1,
  limit: 50,
  hasMore: true,

  /* ---------- selection + sockets ---------- */

  setSelectedChat: (chat) => {
    const normalized = normalizeChat(chat);
    const prev = get().selectedChat;

    set({ selectedChat: normalized });

    try {
      const socket = getSocket();

      if (socket && prev?._id) {
        socket.emit("leave_room", prev._id);
        markLeftRoom(prev._id);
      }

      if (socket && normalized?._id) {
        socket.emit("join_room", normalized._id);
        markJoinedRoom(normalized._id);
      }
    } catch (err) {
      console.warn("socket join/leave failed", err);
    }
  },

  /* ---------- fetch chats ---------- */

  fetchChats: async (page, limit) => {
    set({ isFetchingChats: true });

    try {
      const currentPage = page || get().page;
      const currentLimit = limit || get().limit;

      const res = await axiosInstance.get("/api/chat", {
        params: { page: currentPage, limit: currentLimit },
        validateStatus: (status) => status === 200 || status === 304,
        headers: { "Cache-Control": "no-cache" },
      });

      if (res.status === 200) {
        const raw = res.data?.data || [];
        const data = raw.map(normalizeChat);

        const prevChats = currentPage === 1 ? [] : get().chats;

        set({
          chats: [...prevChats, ...data],
          page: res.data?.page || currentPage,
          limit: res.data?.limit || currentLimit,
          hasMore: data.length === currentLimit,
        });
      }

      if (res.status === 304) {
        set({ hasMore: false });
      }
    } catch (error) {
      if (handleAuthError(error)) return;
      toast.error(error?.response?.data?.message || "failed to load chats");
    } finally {
      set({ isFetchingChats: false });
    }
  },

  /* ---------- access chat ---------- */

  accessChat: async (userId) => {
    set({ isAccessingChat: true });

    try {
      const res = await axiosInstance.post("/api/chat/access", { userId });
      const chat = normalizeChat(res.data);

      const chats = get().chats || [];
      const exists = chats.find((c) => c._id === chat._id);

      set({
        chats: exists
          ? chats.map((c) => (c._id === chat._id ? chat : c))
          : [chat, ...chats],
        selectedChat: chat,
      });
    } catch (error) {
      if (handleAuthError(error)) return;
      toast.error(error?.response?.data?.message || "failed to access chat");
    } finally {
      set({ isAccessingChat: false });
    }
  },

  /* ---------- group ---------- */

  createGroupChat: async ({ name, users, groupAvatar }) => {
    set({ isCreatingGroup: true });

    try {
      let res;

      if (groupAvatar instanceof File) {
        const fd = new FormData();
        fd.append("name", name);
        users.forEach((id) => fd.append("users", id));
        fd.append("groupAvatar", groupAvatar);

        res = await axiosInstance.post("/api/chat/group", fd);
      } else {
        res = await axiosInstance.post("/api/chat/group", {
          name,
          users,
          groupAvatar,
        });
      }

      const chat = normalizeChat(res.data);
      set({ chats: [chat, ...get().chats], selectedChat: chat });

      toast.success("group created successfully");
    } catch (error) {
      if (handleAuthError(error)) return;
      toast.error(error?.response?.data?.message || "failed to create group");
    } finally {
      set({ isCreatingGroup: false });
    }
  },

  renameGroup: async ({ chatId, name, groupAvatar }) => {
    set({ isRenamingGroup: true });

    try {
      const res = await axiosInstance.put("/api/chat/rename", {
        chatId,
        name,
        groupAvatar,
      });

      const updated = normalizeChat(res.data);

      set({
        chats: get().chats.map((c) =>
          c._id === updated._id ? updated : c
        ),
        selectedChat:
          get().selectedChat?._id === updated._id
            ? updated
            : get().selectedChat,
      });

      toast.success("group renamed successfully");
    } catch (error) {
      if (handleAuthError(error)) return;
      toast.error(error?.response?.data?.message || "failed to rename group");
    } finally {
      set({ isRenamingGroup: false });
    }
  },

  addToGroup: async ({ chatId, userId }) => {
    set({ isUpdatingGroup: true });

    try {
      const res = await axiosInstance.put("/api/chat/add", {
        chatId,
        userId,
      });

      const updated = normalizeChat(res.data);

      set({
        chats: get().chats.map((c) =>
          c._id === updated._id ? updated : c
        ),
        selectedChat:
          get().selectedChat?._id === updated._id
            ? updated
            : get().selectedChat,
      });

      toast.success("user added to group");
    } catch (error) {
      if (handleAuthError(error)) return;
      toast.error(error?.response?.data?.message || "failed to add user");
    } finally {
      set({ isUpdatingGroup: false });
    }
  },

  removeFromGroup: async ({ chatId, userId }) => {
    set({ isUpdatingGroup: true });

    try {
      const res = await axiosInstance.put("/api/chat/remove", {
        chatId,
        userId,
      });

      const data = res.data;

      if (data?._id) {
        const updated = normalizeChat(data);

        set({
          chats: get().chats.map((c) =>
            c._id === updated._id ? updated : c
          ),
          selectedChat:
            get().selectedChat?._id === updated._id
              ? updated
              : get().selectedChat,
        });
      } else {
        set({
          chats: get().chats.filter((c) => c._id !== chatId),
          selectedChat:
            get().selectedChat?._id === chatId
              ? null
              : get().selectedChat,
        });
      }

      toast.success("user removed from group");
    } catch (error) {
      if (handleAuthError(error)) return;
      toast.error(error?.response?.data?.message || "failed to remove user");
    } finally {
      set({ isUpdatingGroup: false });
    }
  },

  deleteChat: async (chatId) => {
    if (!chatId) return;
    set({ isDeletingChat: true });

    try {
      await axiosInstance.delete(`/api/chat/${chatId}`);

      set({
        chats: get().chats.filter((c) => c._id !== chatId),
        selectedChat:
          get().selectedChat?._id === chatId
            ? null
            : get().selectedChat,
      });

      toast.success("chat deleted");
    } catch (error) {
      if (handleAuthError(error)) return;
      toast.error(error?.response?.data?.message || "failed to delete chat");
    } finally {
      set({ isDeletingChat: false });
    }
  },
}));

export default chatstore;
