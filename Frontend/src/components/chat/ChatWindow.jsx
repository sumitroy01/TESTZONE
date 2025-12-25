// src/components/chat/ChatWindow.jsx
import { useState, useRef, useEffect } from "react";
import messageStore from "../../store/message.store.js";

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

/* ===================== MESSAGES ===================== */

function ChatMessages({
  messages,
  isFetchingMessages,
  authUserId,
  chatId,
  isGroupChat,
  selectedChat,
}) {
  const { markAsRead, deleteMessage } = messageStore();

  const containerRef = useRef(null);
  const bottomRef = useRef(null);
  const lastReadAtRef = useRef(0);

  const [isUserNearBottom, setIsUserNearBottom] = useState(true);
  const [activeMenuId, setActiveMenuId] = useState(null);

  const showEmptyState = !isFetchingMessages && messages.length === 0;

  const otherUser =
    !isGroupChat && Array.isArray(selectedChat?.users)
      ? selectedChat.users.find((u) => String(u._id) !== String(authUserId))
      : null;
  const otherUserId = otherUser?._id;

  const handleScroll = () => {
    const el = containerRef.current;
    if (!el) return;
    const threshold = 80;
    const distance =
      el.scrollHeight - el.scrollTop - el.clientHeight;
    setIsUserNearBottom(distance < threshold);
  };

  useEffect(() => {
    if (!containerRef.current || !bottomRef.current) return;
    if (!isUserNearBottom) return;
    bottomRef.current.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, isUserNearBottom]);

  /* ✅ FINAL FIX: 15s THROTTLED READ */
  useEffect(() => {
    if (!chatId || !authUserId) return;
    if (!messages.length) return;
    if (!isUserNearBottom) return;

    const now = Date.now();
    if (now - lastReadAtRef.current < 15000) return;

    lastReadAtRef.current = now;

    markAsRead({
      chatId,
      userId: authUserId,
      silent: true,
    });
  }, [chatId, authUserId, isUserNearBottom]);

  const normalizeId = (val) =>
    typeof val === "string" ? val : val?._id?.toString();

  const getMessageStatus = (msg) => {
    const readByIds = Array.isArray(msg.readBy)
      ? msg.readBy.map(normalizeId)
      : [];

    if (isGroupChat) {
      const senderId = normalizeId(msg.sender);
      return readByIds.some((id) => id !== senderId)
        ? "read"
        : "sent";
    } else {
      return readByIds.includes(normalizeId(otherUserId))
        ? "read"
        : "sent";
    }
  };

  const MessageTicks = ({ msg }) =>
    getMessageStatus(msg) === "read" ? (
      <span className="text-[10px] text-white ml-1">✓✓</span>
    ) : (
      <span className="text-[10px] text-white/60 ml-1">✓</span>
    );

  const toggleMenu = (id) =>
    setActiveMenuId((prev) => (prev === id ? null : id));

  const handleDelete = async (e, messageId) => {
    e.stopPropagation();
    await deleteMessage({ messageId, chatId });
    setActiveMenuId(null);
  };

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      className="flex-1 overflow-y-auto px-3 py-3 space-y-2"
    >
      {showEmptyState && (
        <div className="h-full flex items-center justify-center text-xs text-neutral-400">
          No messages yet. Say something.
        </div>
      )}

      {messages.map((msg) => {
        const isMine =
          String(msg.sender?._id || msg.sender) === String(authUserId);

        return (
          <div
            key={msg._id}
            className={`flex ${
              isMine ? "justify-end" : "justify-start"
            }`}
            onClick={() => isMine && toggleMenu(msg._id)}
          >
            <div
              className={`max-w-[75%] rounded-2xl px-3 py-2 ${
                isMine
                  ? "bg-emerald-600 text-white"
                  : "bg-white/5 text-neutral-50"
              }`}
            >
              <p>{msg.content}</p>
              <p className="mt-1 text-[10px] text-right flex items-center justify-end">
                {new Date(msg.createdAt).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
                {isMine && <MessageTicks msg={msg} />}
              </p>
            </div>

            {isMine && activeMenuId === msg._id && (
              <div className="absolute bg-slate-900 rounded-xl px-3 py-2">
                <button
                  onClick={(e) => handleDelete(e, msg._id)}
                  className="text-[11px] text-red-400"
                >
                  Delete message
                </button>
              </div>
            )}
          </div>
        );
      })}

      <div ref={bottomRef} />
    </div>
  );
}

/* ===================== INPUT + EMPTY ===================== */

function ChatInput({ onSend, isSending }) {
  const [value, setValue] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!value.trim()) return;
    onSend({ content: value.trim(), messageType: "text" });
    setValue("");
  };

  return (
    <form onSubmit={handleSubmit} className="p-3 border-t border-white/10">
      <input
        className="w-full bg-white/5 rounded-xl px-3 py-2 text-sm"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Type a message"
      />
      <button disabled={isSending} type="submit" hidden />
    </form>
  );
}

function EmptyChatState() {
  return (
    <div className="flex-1 flex items-center justify-center text-neutral-400">
      No conversation selected
    </div>
  );
}

export default ChatWindow;
