import { create } from "zustand";
import { axiosInstance } from "../lib/axios";
import toast from "react-hot-toast";

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

  // NEW: mark whether we've attempted the initial load already
  didLoadChats: false,

  // Helper: insert or update a chat and move it to the top
  insertOrUpdateChat: (chat, lastMessage) => {
    if (!chat) return;
    const n = normalizeChat(chat);
    if (lastMessage) {
      // keep old key name used elsewhere (latestMessage), and also lastMessage for clarity
      n.latestMessage = lastMessage;
      n.lastMessage = lastMessage;
    }

    set((s) => {
      const chats = s.chats || [];
      const exists = chats.find((c) => c._id === n._id);

      let updatedChats;
      if (exists) {
        updatedChats = chats.map((c) => (c._id === n._id ? { ...c, ...n } : c));
      } else {
        updatedChats = [n, ...chats];
      }

      // ensure target chat is at the front
      const target = updatedChats.find((c) => c._id === n._id);
      const rest = updatedChats.filter((c) => c._id !== n._id);
      return { chats: target ? [target, ...rest] : updatedChats };
    });
  },

  // Called when a new message arrives via socket
  handleIncomingMessage: (message) => {
    if (!message) return;
    // message.chat may be a populated chat object or an id
    const chat = message.chat || (message.chatId ? { _id: message.chatId } : null);
    if (!chat) return;

    // attach the message as latest/lastMessage so UI shows preview
    get().insertOrUpdateChat(chat, message);
  },

  // Called when a chat is created (e.g. someone created a group or accessChat created a 1:1)
  handleChatCreated: (chat) => {
    if (!chat) return;
    get().insertOrUpdateChat(chat);
  },

  // Called when a chat is updated (rename, avatar change, members changed)
  handleChatUpdated: (chat) => {
    if (!chat) return;
    const normalized = normalizeChat(chat);
    set((s) => {
      const chats = s.chats || [];
      const updatedChats = chats.map((c) =>
        c._id === normalized._id ? { ...c, ...normalized } : c
      );
      // keep selectedChat in sync if it's the same chat
      const selectedChat = s.selectedChat;
      const newSelected =
        selectedChat && selectedChat._id === normalized._id
          ? { ...selectedChat, ...normalized }
          : selectedChat;

      // move updated chat to top
      const target = updatedChats.find((c) => c._id === normalized._id);
      const rest = updatedChats.filter((c) => c._id !== normalized._id);

      return {
        chats: target ? [target, ...rest] : updatedChats,
        selectedChat: newSelected,
      };
    });
  },

  // Called when a chat is deleted
  handleChatDeleted: (chatId) => {
    if (!chatId) return;
    set((s) => {
      const chats = s.chats || [];
      const filtered = chats.filter((c) => c._id !== chatId);
      const selectedChat = s.selectedChat;
      const newSelected = selectedChat && selectedChat._id === chatId ? null : selectedChat;
      return { chats: filtered, selectedChat: newSelected };
    });
  },

  setSelectedChat: (chat) => {
    set({ selectedChat: normalizeChat(chat) });
  },

  fetchChats: async (page, limit) => {
    set({ isFetchingChats: true });
    try {
      const currentPage = page || get().page;
      const currentLimit = limit || get().limit;

      const res = await axiosInstance.get("/api/chat", {
        params: {
          page: currentPage,
          limit: currentLimit,
        },
      });

      const rawData = res.data?.data || [];
      const data = rawData.map(normalizeChat);

      const newPage = res.data?.page || currentPage;
      const newLimit = res.data?.limit || currentLimit;
      const prevChats = currentPage === 1 ? [] : get().chats;

      const merged = [...prevChats, ...data];

      set({
        chats: merged,
        page: newPage,
        limit: newLimit,
        hasMore: data.length === newLimit,
      });
    } catch (error) {
      console.log("error in fetchChats:", error?.response?.data || error);
      toast.error(error?.response?.data?.message || "failed to load chats");
    } finally {
      // ensure we mark that we attempted loading chats so we don't loop
      set({ isFetchingChats: false, didLoadChats: true });
    }
  },

  accessChat: async (userId) => {
    set({ isAccessingChat: true });
    try {
      const res = await axiosInstance.post("/api/chat/access", { userId });

      const chat = normalizeChat(res.data);
      const chats = get().chats || [];
      const exists = chats.find((c) => c._id === chat._id);

      const updatedChats = exists
        ? chats.map((c) => (c._id === chat._id ? chat : c))
        : [chat, ...chats];

      set({
        chats: updatedChats,
        selectedChat: chat,
      });
    } catch (error) {
      console.log("error in accessChat:", error?.response?.data || error);
      toast.error(error?.response?.data?.message || "failed to access chat");
    } finally {
      set({ isAccessingChat: false });
    }
  },

  createGroupChat: async ({ name, users, groupAvatar }) => {
    set({ isCreatingGroup: true });
    try {
      let res;

      if (groupAvatar instanceof File) {
        const formData = new FormData();
        formData.append("name", name);
        users.forEach((id) => formData.append("users", id));
        formData.append("groupAvatar", groupAvatar);

        res = await axiosInstance.post("/api/chat/group", formData, {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        });
      } else {
        const payload = { name, users };
        if (groupAvatar) {
          payload.groupAvatar = groupAvatar;
        }

        res = await axiosInstance.post("/api/chat/group", payload);
      }

      const newChat = normalizeChat(res.data);
      const chats = get().chats || [];

      set({
        chats: [newChat, ...chats],
        selectedChat: newChat,
      });

      toast.success("group created sucessfully");
    } catch (error) {
      console.log("error in createGroupChat:", error?.response?.data || error);
      toast.error(error?.response?.data?.message || "failed to create group");
    } finally {
      set({ isCreatingGroup: false });
    }
  },

  renameGroup: async ({ chatId, name, groupAvatar }) => {
    set({ isRenamingGroup: true });
    try {
      let res;

      if (groupAvatar instanceof File) {
        const formData = new FormData();
        formData.append("chatId", chatId);
        if (name) {
          formData.append("name", name);
        }
        formData.append("groupAvatar", groupAvatar);

        res = await axiosInstance.put("/api/chat/rename", formData, {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        });
      } else {
        const payload = { chatId, name };
        if (groupAvatar) {
          payload.groupAvatar = groupAvatar;
        }

        res = await axiosInstance.put("/api/chat/rename", payload);
      }

      const updatedChat = normalizeChat(res.data);
      const chats = get().chats || [];
      const selectedChat = get().selectedChat;

      const updatedChats = chats.map((c) =>
        c._id === updatedChat._id ? updatedChat : c
      );

      const newSelected =
        selectedChat && selectedChat._id === updatedChat._id
          ? updatedChat
          : selectedChat;

      set({
        chats: updatedChats,
        selectedChat: newSelected,
      });

      toast.success("group renamed sucessfully");
    } catch (error) {
      console.log("error in renameGroup:", error?.response?.data || error);
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

      const updatedChat = normalizeChat(res.data);
      const chats = get().chats || [];
      const selectedChat = get().selectedChat;

      const updatedChats = chats.map((c) =>
        c._id === updatedChat._id ? updatedChat : c
      );

      const newSelected =
        selectedChat && selectedChat._id === updatedChat._id
          ? updatedChat
          : selectedChat;

      set({
        chats: updatedChats,
        selectedChat: newSelected,
      });

      toast.success("user added to group");
    } catch (error) {
      console.log("error in addToGroup:", error?.response?.data || error);
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
      const chats = get().chats || [];
      const selectedChat = get().selectedChat;

      if (data && data._id) {
        const updatedChat = normalizeChat(data);
        const updatedChats = chats.map((c) =>
          c._id === updatedChat._id ? updatedChat : c
        );

        const newSelected =
          selectedChat && selectedChat._id === updatedChat._id
            ? updatedChat
            : selectedChat;

        set({
          chats: updatedChats,
          selectedChat: newSelected,
        });
      } else {
        const filtered = chats.filter((c) => c._id !== chatId);
        const newSelected =
          selectedChat && selectedChat._id === chatId ? null : selectedChat;

        set({
          chats: filtered,
          selectedChat: newSelected,
        });
      }

      toast.success("user removed from group");
    } catch (error) {
      console.log(
        "error in removeFromGroup:",
        error?.response?.data || error
      );
      toast.error(
        error?.response?.data?.message || "failed to remove user"
      );
    } finally {
      set({ isUpdatingGroup: false });
    }
  },

  deleteChat: async (chatId) => {
    if (!chatId) return;
    set({ isDeletingChat: true });
    try {
      await axiosInstance.delete(`/api/chat/${chatId}`);

      const chats = get().chats || [];
      const selectedChat = get().selectedChat;

      const filtered = chats.filter((c) => c._id !== chatId);
      const newSelected =
        selectedChat && selectedChat._id === chatId ? null : selectedChat;

      set({
        chats: filtered,
        selectedChat: newSelected,
      });

      toast.success("chat deleted");
    } catch (error) {
      console.log("error in deleteChat:", error?.response?.data || error);
      toast.error(error?.response?.data?.message || "failed to delete chat");
    } finally {
      set({ isDeletingChat: false });
    }
  },
}));

export default chatstore;
