import Messages from "../models/message-models.js";
import Chats from "../models/chat-models.js";
import {
  addUserSocket,
  removeUserSocket,
  getOnlineUsers,
  getReceiverSocketIds,
  emitToRoom,
  emitToUser,
  setActiveChat,
  clearActiveChat,
  getActiveChat,
} from "./socket.js";

export function attachSocketHandlers(io) {
  io.on("connection", (socket) => {
    const userId = socket.data?.userId;
    const socketId = socket.id;

    console.log("socket connected:", socketId, "user:", userId);

    if (userId) addUserSocket(userId, socketId);
    io.emit("getOnlineUsers", getOnlineUsers());

    /* ========== ROOMS ========== */

    socket.on("join_room", (chatId) => {
      if (chatId) socket.join(chatId);
    });

    socket.on("leave_room", (chatId) => {
      if (chatId) socket.leave(chatId);
    });

    /* ========== CHAT PRESENCE ========== */

    socket.on("chat:open", async ({ chatId }) => {
      if (!userId || !chatId) return;

      setActiveChat(userId, chatId);

      await Messages.updateMany(
        { chat: chatId, readBy: { $ne: userId } },
        { $addToSet: { readBy: userId } }
      );

      emitToRoom(chatId, "messages_read", {
        chatId,
        by: String(userId),
      });
    });

    socket.on("chat:close", ({ chatId }) => {
      if (!userId || !chatId) return;
      clearActiveChat(userId, chatId);
    });

    /* ========== SEND MESSAGE ========== */

    socket.on("send_message", async (payload = {}, ack) => {
      try {
        const { chatId, content, messageType = "text", clientId } = payload;
        if (!chatId || !userId) return;

        const chat = await Chats.findById(chatId).select("allUsers isGroup");
        if (!chat) return;

        let receiverId;
        if (!chat.isGroup) {
          receiverId = chat.allUsers.find(
            (u) => String(u) !== String(userId)
          );
        } else {
          receiverId = userId;
        }

        const receiverActiveChat = getActiveChat(receiverId);
        const readBy = [userId];

        if (receiverActiveChat === String(chatId)) {
          readBy.push(receiverId);
        }

        const message = await Messages.create({
          chat: chatId,
          sender: userId,
          receiver: receiverId,
          content,
          messageType,
          readBy,
        });

        const fullMessage = await Messages.findById(message._id)
          .populate("sender", "-password")
          .populate("chat");

        emitToRoom(chatId, "message", {
          ...fullMessage.toObject(),
          clientId: clientId || null,
        });

        emitToUser(receiverId, "message", {
          ...fullMessage.toObject(),
          clientId: clientId || null,
        });

        if (receiverActiveChat === String(chatId)) {
          emitToRoom(chatId, "messages_read", {
            chatId,
            by: String(receiverId),
          });
        }

        ack?.({ ok: true, messageId: message._id });
      } catch (err) {
        console.error("send_message error:", err);
        ack?.({ ok: false });
      }
    });

    /* ========== DISCONNECT ========== */

    socket.on("disconnect", () => {
      if (userId) removeUserSocket(userId, socketId);
      io.emit("getOnlineUsers", getOnlineUsers());
    });
  });
}
