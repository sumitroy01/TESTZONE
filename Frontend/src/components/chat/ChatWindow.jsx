// src/components/chat/ChatWindow.jsx
import { useState, useRef, useEffect } from "react";
import messageStore from "../../store/message.store.js";
import { getSocket } from "../../socket.js";

function ChatWindow({
  selectedChat,
  messages,
  isFetchingMessages,
  authUserId,
  onSend,
  isSending,
  onEditGroup,
  onDeleteChat,
  isDeletingChat,
}) {
  const isGroupChat = selectedChat?.isGroupChat || selectedChat?.isGroup;

  const handleSend = async (payload) => {
    if (!selectedChat?._id) return;

    // media message
    if (payload.mediaFile) {
      const form = new FormData();
      form.append("chatId", selectedChat._id);
      if (payload.content) form.append("content", payload.content);
      if (payload.messageType) form.append("messageType", payload.messageType);
      if (payload.audioDuration != null) {
        form.append("audioDuration", String(payload.audioDuration));
      }
      form.append("media", payload.mediaFile);
      await onSend(form);
      return;
    }

    const text =
      typeof payload.content === "string" ? payload.content.trim() : "";
    if (!text) return;

    await onSend({
      chatId: selectedChat._id,
      content: text,
      messageType: payload.messageType || "text",
    });
  };

  return (
    <section className="flex-1 flex flex-col bg-gradient-to-br from-slate-950 via-slate-950 to-slate-900">
      {selectedChat ? (
        <>
          <ChatHeader
            chat={selectedChat}
            isGroupChat={isGroupChat}
            authUserId={authUserId}
            onEditGroup={onEditGroup}
            onDeleteChat={onDeleteChat}
            isDeletingChat={isDeletingChat}
          />

          <ChatMessages
            messages={messages}
            isFetchingMessages={isFetchingMessages}
            authUserId={authUserId}
            chatId={selectedChat._id}
            isGroupChat={isGroupChat}
            selectedChat={selectedChat}
          />

          <ChatInput onSend={handleSend} isSending={isSending} />
        </>
      ) : (
        <EmptyChatState />
      )}
    </section>
  );
}

/* ---------------- HEADER ---------------- */

function ChatHeader({
  chat,
  isGroupChat,
  authUserId,
  onEditGroup,
  onDeleteChat,
  isDeletingChat,
}) {
  const otherUser =
    !isGroupChat && Array.isArray(chat?.users)
      ? chat.users.find((u) => String(u._id) !== String(authUserId))
      : null;

  const title = isGroupChat
    ? chat.chatName || chat.groupName || "Group"
    : otherUser?.name || otherUser?.username || otherUser?.email || "Chat";

  const subtitle = isGroupChat
    ? `${chat?.users?.length || 0} members`
    : "Direct message";

  const avatar = isGroupChat ? chat.groupAvatar : otherUser?.avatar;

  const avatarInitial = isGroupChat
    ? (chat.chatName || "G")[0].toUpperCase()
    : (otherUser?.name || "U")[0].toUpperCase();

  return (
    <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between bg-slate-950/70">
      <div className="flex items-center gap-3">
        <div className="h-9 w-9 rounded-full overflow-hidden">
          {avatar ? (
            <img src={avatar} alt="avatar" className="h-full w-full object-cover" />
          ) : (
            <div className="h-full w-full rounded-full bg-emerald-500 flex items-center justify-center text-xs font-semibold text-slate-950">
              {avatarInitial}
            </div>
          )}
        </div>
        <div>
          <p className="text-sm font-semibold text-white">{title}</p>
          <p className="text-[11px] text-neutral-400">{subtitle}</p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {isGroupChat && (
          <button
            className="text-[11px] px-2.5 py-1.5 rounded-full bg-white/5"
            onClick={() => onEditGroup?.(chat)}
          >
            Edit group
          </button>
        )}

        <button
          className="text-[11px] px-2.5 py-1.5 rounded-full bg-red-500/10 text-red-300"
          onClick={() => onDeleteChat?.(chat)}
          disabled={isDeletingChat}
        >
          {isDeletingChat ? "Deleting..." : "Delete"}
        </button>
      </div>
    </div>
  );
}

/* ---------------- MESSAGES ---------------- */

function ChatMessages({
  messages,
  isFetchingMessages,
  authUserId,
  chatId,
  isGroupChat,
  selectedChat,
}) {
  const { deleteMessage } = messageStore();
  const bottomRef = useRef(null);
  const lastEmitRef = useRef(0);

  // auto scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  // 🔥 SOCKET mark_read (FIX)
  useEffect(() => {
    if (!chatId || !authUserId) return;
    if (!messages.length) return;

    const socket = getSocket();
    if (!socket) return;

    const now = Date.now();
    if (now - lastEmitRef.current < 15000) return;

    lastEmitRef.current = now;

    socket.emit("mark_read", { chatId });
  }, [chatId, authUserId, messages.length]);

  const normalizeId = (v) =>
    typeof v === "string" ? v : v?._id ? String(v._id) : null;

  const otherUser =
    !isGroupChat && selectedChat?.users
      ? selectedChat.users.find(
          (u) => normalizeId(u._id) !== normalizeId(authUserId)
        )
      : null;

  const getMessageStatus = (msg) => {
    const readByIds = (msg.readBy || []).map(normalizeId);
    if (isGroupChat) return readByIds.length > 1 ? "read" : "sent";
    return readByIds.includes(normalizeId(otherUser?._id)) ? "read" : "sent";
  };

  return (
    <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
      {!isFetchingMessages &&
        messages.map((msg) => {
          const isMine = normalizeId(msg.sender) === normalizeId(authUserId);

          return (
            <div
              key={msg._id}
              className={`flex ${isMine ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm ${
                  isMine ? "bg-emerald-600 text-white" : "bg-white/5 text-white"
                }`}
              >
                <p>{msg.content}</p>
                <div className="flex justify-end text-[10px] opacity-70">
                  {new Date(msg.createdAt).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                  {isMine && (
                    <span className="ml-1">
                      {getMessageStatus(msg) === "read" ? "✓✓" : "✓"}
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      <div ref={bottomRef} />
    </div>
  );
}

/* ---------------- INPUT ---------------- */

function ChatInput({ onSend, isSending }) {
  const [value, setValue] = useState("");

  const submit = (e) => {
    e.preventDefault();
    if (!value.trim()) return;
    onSend({ content: value.trim(), messageType: "text" });
    setValue("");
  };

  return (
    <form onSubmit={submit} className="p-3 border-t border-white/10 flex gap-2">
      <input
        className="flex-1 bg-white/5 rounded-xl px-3 py-2 text-sm text-white"
        placeholder="Type a message"
        value={value}
        onChange={(e) => setValue(e.target.value)}
      />
      <button
        disabled={isSending}
        className="px-4 py-2 rounded-xl bg-emerald-500 text-slate-950 text-sm font-semibold"
      >
        Send
      </button>
    </form>
  );
}

function EmptyChatState() {
  return (
    <div className="flex-1 flex items-center justify-center text-neutral-400">
      Select a chat to start messaging
    </div>
  );
}

export default ChatWindow;
