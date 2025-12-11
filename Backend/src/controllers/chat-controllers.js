import mongoose from "mongoose";
import Chats from "../models/chat-models.js"; // adjust path as needed
import Messages from "../models/message-models.js";
import Users from "../models/user-models.js";

const toObjectId = (id) =>
  mongoose.Types.ObjectId.isValid(id) ? mongoose.Types.ObjectId(id) : null;

/**
 * Helper to get socket.io instance if available.
 * Preferred: set io on express app with app.set('io', io)
 * Fallback: global.io if you attached it there.
 */
const getIo = (req) => {
  return (req && req.app && req.app.get && req.app.get("io")) || global.io || null;
};

export const accessChat = async (req, res) => {
  try {
    const otherUserId = req.body.userId || req.query.userId;

    if (!otherUserId) {
      return res.status(400).json({ message: "userId required" });
    }

    const requesterId = req.user._id;

    let chat = await Chats.findOne({
      isGroup: false,
      allUsers: { $all: [requesterId, otherUserId] },
    })
      .populate("allUsers", "-password")
      .populate("admins", "-password");

    if (chat) {
      const latest = await Messages.findOne({ chat: chat._id })
        .sort({ createdAt: -1 })
        .populate("sender", "-password");

      const chatObj = chat.toObject();
      chatObj.latestMessage = latest || null;

      // normalize for frontend: isGroupChat + users
      chatObj.isGroupChat = !!chatObj.isGroup;
      chatObj.users = chatObj.allUsers;

      return res.status(200).json(chatObj);
    }

    // 3) If no chat, create it
    const newChat = await Chats.create({
      isGroup: false,
      allUsers: [requesterId, otherUserId],
      admins: [requesterId],
    });

    let fullChat = await Chats.findById(newChat._id)
      .populate("allUsers", "-password")
      .populate("admins", "-password");

    const full = fullChat.toObject();
    full.latestMessage = null;
    full.isGroupChat = !!full.isGroup;
    full.users = full.allUsers;

    // emit real-time event to both users (if io available)
    try {
      const io = getIo(req);
      if (io && Array.isArray(full.users)) {
        full.users.forEach((u) => {
          if (u && u._id) {
            io.to(String(u._id)).emit("chatCreated", full);
          }
        });
      }
    } catch (emitErr) {
      console.warn("emit chatCreated failed:", emitErr);
    }

    return res.status(201).json(full);
  } catch (err) {
    console.error("error in accessChat controller:", err);
    return res
      .status(500)
      .json({ message: "Server error", error: err.message });
  }
};

export const fetchChats = async (req, res) => {
  try {
    const requesterId = req.user._id;
    const limit = Math.max(1, parseInt(req.query.limit || "50"));
    const page = Math.max(1, parseInt(req.query.page || "1"));
    const skip = (page - 1) * limit;

    const chats = await Chats.find({ allUsers: requesterId })
      .sort({ updatedAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("allUsers", "-password")
      .populate("admins", "-password");

    // attach latestMessage for each chat and populate latestMessage.sender
    const result = await Promise.all(
      chats.map(async (c) => {
        const latest = await Messages.findOne({ chat: c._id })
          .sort({ createdAt: -1 })
          .populate("sender", "-password");
        const obj = c.toObject();
        obj.latestMessage = latest || null;
        return obj;
      })
    );

    return res.json({ page, limit, data: result });
  } catch (err) {
    console.error(err);
    return res
      .status(500)
      .json({ message: "Server error", error: err.message });
  }
};

export const createGroupChat = async (req, res) => {
  try {
    const { name, users, groupAvatar } = req.body;
    if (!name || !users)
      return res.status(400).json({ message: "name and users required" });

    if (!Array.isArray(users))
      return res.status(400).json({ message: "users must be an array" });
    if (users.length < 1)
      return res
        .status(400)
        .json({
          message:
            "need at least 2 other users to create a group (group size >=3)",
        });

    const requesterId = req.user._id;
    const unique = Array.from(new Set(users.map((u) => String(u))));
    const allUsers = [String(requesterId), ...unique];

    let finalAvatar = "";
    if (req.file) {
      finalAvatar = req.file.path;
    } else if (groupAvatar) {
      finalAvatar = groupAvatar;
    }

    const created = await Chats.create({
      isGroup: true,
      groupName: name,
      groupAvatar: finalAvatar,
      admins: [requesterId],
      allUsers,
    });

    const populated = await Chats.findById(created._id)
      .populate("allUsers", "-password")
      .populate("admins", "-password");
    const obj = populated.toObject();
    obj.latestMessage = null;

    // emit chatCreated to every member
    try {
      const io = getIo(req);
      if (io && Array.isArray(obj.allUsers)) {
        obj.allUsers.forEach((u) => {
          io.to(String(u)).emit("chatCreated", obj);
        });
      }
    } catch (emitErr) {
      console.warn("emit chatCreated failed:", emitErr);
    }

    return res.status(201).json(obj);
  } catch (err) {
    console.error(err);
    return res
      .status(500)
      .json({ message: "Server error", error: err.message });
  }
};

export const renameGroup = async (req, res) => {
  try {
    // ✅ make this safe even if req.body is undefined
    const body = req.body || {};
    const chatId = body.chatId;
    const name = body.name;
    const groupAvatarFromBody = body.groupAvatar;

    if (!chatId) {
      return res.status(400).json({ message: "chatId required" });
    }

    const chat = await Chats.findById(chatId);
    if (!chat) return res.status(404).json({ message: "chat not found" });

    const requester = String(req.user._id);
    const isAdmin = (chat.admins || []).map(String).includes(requester);
    if (!isAdmin) {
      return res
        .status(403)
        .json({ message: "only group admins can rename group" });
    }

    if (name) {
      chat.groupName = name;
    }

    // ✅ same pattern as updateProfile
    if (req.file) {
      chat.groupAvatar = req.file.path;
    } else if (groupAvatarFromBody) {
      chat.groupAvatar = groupAvatarFromBody;
    }

    await chat.save();

    const populated = await Chats.findById(chat._id)
      .populate("allUsers", "-password")
      .populate("admins", "-password");

    const latest = await Messages.findOne({ chat: chat._id })
      .sort({ createdAt: -1 })
      .populate("sender", "-password");

    const obj = populated.toObject();
    obj.latestMessage = latest || null;

    // emit chatUpdated to all members
    try {
      const io = getIo(req);
      if (io && Array.isArray(obj.allUsers)) {
        obj.allUsers.forEach((u) => {
          io.to(String(u)).emit("chatUpdated", obj);
        });
      }
    } catch (emitErr) {
      console.warn("emit chatUpdated failed:", emitErr);
    }

    return res.json(obj);
  } catch (err) {
    console.error(err);
    return res
      .status(500)
      .json({ message: "Server error", error: err.message });
  }
};

export const addToGroup = async (req, res) => {
  try {
    const { chatId, userId } = req.body;
    if (!chatId || !userId)
      return res.status(400).json({ message: "chatId and userId required" });

    const chat = await Chats.findById(chatId);
    if (!chat) return res.status(404).json({ message: "chat not found" });

    const requester = String(req.user._id);
    const isAdmin = (chat.admins || []).map(String).includes(requester);
    if (!isAdmin)
      return res
        .status(403)
        .json({ message: "only group admins can add members" });

    const already = (chat.allUsers || []).map(String).includes(String(userId));
    if (already)
      return res.status(400).json({ message: "user already in group" });

    chat.allUsers.push(userId);
    await chat.save();

    const populated = await Chats.findById(chat._id)
      .populate("allUsers", "-password")
      .populate("admins", "-password");
    const latest = await Messages.findOne({ chat: chat._id })
      .sort({ createdAt: -1 })
      .populate("sender", "-password");
    const obj = populated.toObject();
    obj.latestMessage = latest || null;

    // emit chatUpdated to all members & addedToGroup to the new user
    try {
      const io = getIo(req);
      if (io && Array.isArray(obj.allUsers)) {
        obj.allUsers.forEach((u) => {
          io.to(String(u)).emit("chatUpdated", obj);
        });
        // notify the added user specifically
        io.to(String(userId)).emit("addedToGroup", obj);
      }
    } catch (emitErr) {
      console.warn("emit addToGroup notifications failed:", emitErr);
    }

    return res.json(obj);
  } catch (err) {
    console.error(err);
    return res
      .status(500)
      .json({ message: "Server error", error: err.message });
  }
};

export const removeFromGroup = async (req, res) => {
  try {
    const { chatId, userId } = req.body;
    if (!chatId || !userId)
      return res.status(400).json({ message: "chatId and userId required" });

    const chat = await Chats.findById(chatId);
    if (!chat) return res.status(404).json({ message: "chat not found" });

    const requester = String(req.user._id);
    const removingSelf = String(userId) === requester;
    const isAdmin = (chat.admins || []).map(String).includes(requester);

    if (!removingSelf && !isAdmin)
      return res
        .status(403)
        .json({ message: "only admins can remove other users" });

    chat.allUsers = (chat.allUsers || []).filter(
      (u) => String(u) !== String(userId)
    );
    chat.admins = (chat.admins || []).filter(
      (a) => String(a) !== String(userId)
    );
    await chat.save();

    if ((chat.allUsers || []).length <= 1) {
      // capture previous members to notify them about deletion
      const previousMembers = [...(chat.allUsers || []), String(userId)];
      await Chats.findByIdAndDelete(chat._id);
      // optionally delete messages too
      await Messages.deleteMany({ chat: chat._id });

      // notify previous members that chat was deleted
      try {
        const io = getIo(req);
        if (io && Array.isArray(previousMembers)) {
          previousMembers.forEach((u) => {
            io.to(String(u)).emit("chatDeleted", { chatId: String(chat._id) });
          });
        }
      } catch (emitErr) {
        console.warn("emit chatDeleted failed:", emitErr);
      }

      return res.json({
        message: "group removed as too few members remained; chat deleted",
      });
    }

    const populated = await Chats.findById(chat._id)
      .populate("allUsers", "-password")
      .populate("admins", "-password");
    const latest = await Messages.findOne({ chat: chat._id })
      .sort({ createdAt: -1 })
      .populate("sender", "-password");
    const obj = populated.toObject();
    obj.latestMessage = latest || null;

    // emit chatUpdated to remaining members and removedFromGroup to the removed user
    try {
      const io = getIo(req);
      if (io) {
        (obj.allUsers || []).forEach((u) => {
          io.to(String(u)).emit("chatUpdated", obj);
        });
        io.to(String(userId)).emit("removedFromGroup", {
          chatId: String(chat._id),
          removedUserId: String(userId),
        });
      }
    } catch (emitErr) {
      console.warn("emit removeFromGroup notifications failed:", emitErr);
    }

    return res.json(obj);
  } catch (err) {
    console.error(err);
    return res
      .status(500)
      .json({ message: "Server error", error: err.message });
  }
};

export const deleteChat = async (req, res) => {
  try {
    const chatId = req.params.chatId || req.body.chatId;
    if (!chatId) return res.status(400).json({ message: "chatId required" });

    const chat = await Chats.findById(chatId);
    if (!chat) return res.status(404).json({ message: "chat not found" });

    const requester = String(req.user._id);
    const isParticipant = (chat.allUsers || []).map(String).includes(requester);
    if (!isParticipant) {
      return res
        .status(403)
        .json({ message: "not allowed to delete this chat" });
    }

    // capture previous members to notify them
    const previousMembers = (chat.allUsers || []).map(String);

    await Chats.findByIdAndDelete(chatId);
    await Messages.deleteMany({ chat: chatId });

    // notify previous members the chat was deleted
    try {
      const io = getIo(req);
      if (io && Array.isArray(previousMembers)) {
        previousMembers.forEach((u) => {
          io.to(String(u)).emit("chatDeleted", { chatId: String(chatId) });
        });
      }
    } catch (emitErr) {
      console.warn("emit chatDeleted failed:", emitErr);
    }

    return res.json({ message: "chat deleted", chatId });
  } catch (err) {
    console.error(err);
    return res
      .status(500)
      .json({ message: "Server error", error: err.message });
  }
};
