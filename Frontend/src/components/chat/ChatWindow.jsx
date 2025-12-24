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

          <ChatInput onSend={onSend} isSending={isSending} />
        </>
      ) : (
        <EmptyChatState />
      )}
    </section>
  );
}

/* -------------------- CHAT HEADER -------------------- */

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
    : otherUser?.name || otherUser?.email || "Conversation";

  const subtitle = isGroupChat
    ? `${chat?.users?.length || 0} members`
    : "Direct message";

  return (
    <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between bg-slate-950/70 backdrop-blur-md">
      <div>
        <p className="text-sm font-semibold text-neutral-50">{title}</p>
        <p className="text-[11px] text-neutral-400">{subtitle}</p>
      </div>

      <div className="flex gap-2">
        {isGroupChat && (
          <button
            className="text-[11px] px-2 py-1 rounded bg-white/5"
            onClick={() => onEditGroup?.(chat)}
          >
            Edit group
          </button>
        )}
        <button
          className="text-[11px] px-2 py-1 rounded bg-red-500/20 text-red-300"
          onClick={() => onDeleteChat?.(chat)}
          disabled={isDeletingChat}
        >
          Delete
        </button>
      </div>
    </div>
  );
}

/* -------------------- CHAT MESSAGES -------------------- */

function ChatMessages({
  messages,
  isFetchingMessages,
  authUserId,
  chatId,
  isGroupChat,
  selectedChat,
}) {
  const { markAsRead, fetchMessages } = messageStore();

  const bottomRef = useRef(null);

  // ✅ MARK AS READ WHEN CHAT OPENS (ONLY chatId)
  useEffect(() => {
    if (!chatId) return;

    const run = async () => {
      await markAsRead({ chatId });
      await fetchMessages({ chatId, page: 1, limit: 50 });
    };

    run();
  }, [chatId, markAsRead, fetchMessages]);

  // auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  const normalizeId = (v) =>
    typeof v === "string" ? v : v?._id?.toString();

  const getMessageStatus = (msg) => {
    const readBy = (msg.readBy || []).map(normalizeId);

    if (isGroupChat) {
      const senderId = normalizeId(msg.sender);
      return readBy.filter((id) => id !== senderId).length
        ? "read"
        : "sent";
    }

    return readBy.includes(normalizeId(authUserId))
      ? "read"
      : "sent";
  };

  return (
    <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
      {!isFetchingMessages &&
        messages.map((msg) => {
          const isMine =
            normalizeId(msg.sender) === normalizeId(authUserId);

          return (
            <div
              key={msg._id}
              className={`flex ${isMine ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`px-3 py-2 rounded-xl text-sm ${
                  isMine
                    ? "bg-emerald-600 text-white"
                    : "bg-white/10 text-white"
                }`}
              >
                <p>{msg.content}</p>

                <div className="text-[10px] text-right mt-1">
                  {isMine && (
                    <span>
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

/* -------------------- INPUT -------------------- */

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
        className="flex-1 bg-white/5 rounded px-3 text-sm"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Type a message"
      />
      <button
        disabled={isSending}
        className="px-4 py-2 bg-emerald-500 text-black text-xs rounded"
      >
        Send
      </button>
    </form>
  );
}

function EmptyChatState() {
  return (
    <div className="flex-1 flex items-center justify-center text-neutral-400">
      Select a chat
    </div>
  );
}

export default ChatWindow;
