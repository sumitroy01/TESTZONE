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

  /* ================= INCOMING MESSAGE ================= */

  socket.on("message", (msg) => {
    try {
      const chatId =
        msg?.chat?._id ||
        msg?.chat ||
        msg?.chatId;

      if (!chatId) {
        console.warn("socket message missing chatId", msg);
        return;
      }

      messageStore
        .getState()
        .addIncomingMessage(String(chatId), msg);

      // update latest message in chat list
      const chats = chatstore.getState().chats || [];
      const exists = chats.some((c) => String(c._id) === String(chatId));

      if (exists) {
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

  /* ================= MESSAGE DELETED ================= */

  socket.on("message_deleted", ({ messageId, chatId }) => {
    if (!messageId || !chatId) return;
    messageStore
      .getState()
      .deleteMessage({ messageId, chatId });
  });

  /* ================= READ RECEIPTS ================= */

  socket.on("messages_read", ({ chatId, by, messageId }) => {
    if (!chatId || !by) return;

    messageStore.getState().markAsRead({
      chatId,
      messageId,
      userId: by,
      silent: true, // 👈 important: no side-effects
    });
  });

  /* ================= PRESENCE (OPTIONAL) ================= */

  socket.on("getOnlineUsers", (users) => {
    console.debug("online users:", users);
  });

  /* ================= NEW CHAT ================= */

  socket.on("newChat", (chat) => {
    if (!chat) return;
    const chats = chatstore.getState().chats || [];
    const exists = chats.some((c) => String(c._id) === String(chat._id));
    if (!exists) {
      chatstore.setState({ chats: [chat, ...chats] });
    }
  });
}
