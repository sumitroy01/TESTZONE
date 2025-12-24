// src/lib/socket-listeners.js
import { getSocket } from "../socket.js";
import chatstore from "../store/chat.store";
import messageStore from "../store/message.store";

let registered = false;

export function registerSocketListeners() {
  if (registered) return;
  registered = true;

  const socket = getSocket();
  if (!socket) {
    console.warn("registerSocketListeners: socket not initialized");
    return;
  }

  /* ---------- incoming message ---------- */
  socket.on("message", (msg) => {
    try {
      const chatId =
        (msg.chat && (msg.chat._id || msg.chat)) || msg.chatId;

      if (!chatId) return;

      messageStore
        .getState()
        .addIncomingMessage(String(chatId), msg);

      // update latest message in chat list
      const chats = chatstore.getState().chats || [];
      if (chats.length) {
        chatstore.setState({
          chats: chats.map((c) =>
            String(c._id) === String(chatId)
              ? { ...c, latestMessage: msg }
              : c
          ),
        });
      }
    } catch (err) {
      console.error("socket message handler error", err);
    }
  });

  /* ---------- messages read (✅ FIXED) ---------- */
  socket.on("messages_read", ({ chatId, by, messageId }) => {
    try {
      if (!chatId || !by) return;

      // ✅ PURE local update — NO API CALL
      messageStore.getState().applyMessagesRead({
        chatId,
        by,
        messageId,
      });
    } catch (err) {
      console.error("socket messages_read handler error", err);
    }
  });

  /* ---------- message deleted ---------- */
  socket.on("message_deleted", ({ messageId, chatId }) => {
    try {
      if (!messageId || !chatId) return;

      messageStore.setState((state) => {
        const entry = state.messagesByChat[chatId];
        if (!entry?.data) return state;

        return {
          messagesByChat: {
            ...state.messagesByChat,
            [chatId]: {
              ...entry,
              data: entry.data.filter(
                (m) => String(m._id) !== String(messageId)
              ),
            },
          },
        };
      });
    } catch (err) {
      console.error("socket message_deleted handler error", err);
    }
  });

  /* ---------- chat messages deleted ---------- */
  socket.on("chat_messages_deleted", ({ chatId }) => {
    if (!chatId) return;
    messageStore.getState().clearMessagesForChat(chatId);
  });

  /* ---------- online users (optional) ---------- */
  socket.on("getOnlineUsers", (users) => {
    console.debug("online users:", users);
  });

  /* ---------- new chat (optional) ---------- */
  socket.on("newChat", (chat) => {
    try {
      if (!chat) return;

      const chats = chatstore.getState().chats || [];
      const exists = chats.some(
        (c) => String(c._id) === String(chat._id)
      );

      if (!exists) {
        chatstore.setState({ chats: [chat, ...chats] });
      }
    } catch (err) {
      console.error("socket newChat handler error", err);
    }
  });
}
