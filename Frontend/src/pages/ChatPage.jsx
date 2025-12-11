import { useEffect, useMemo, useState, useRef } from "react";

import authStore from "../store/auth.store.js";
import chatstore from "../store/chat.store.js";
import userstore from "../store/user.store.js";
import messageStore from "../store/message.store.js";

import ChatSidebar from "../components/chat/ChatSidebar.jsx";
import ChatWindow from "../components/chat/ChatWindow.jsx";
import CreateGroupModal from "../components/chat/CreateGroupModal.jsx";
import EditGroupModal from "../components/chat/EditGroupModal.jsx";

// Try to import socket instance (if you have one)
// If you don't have ../lib/socket, ensure you expose socket to window.__socket in your client init
import socketFromLib from "../lib/socket"; // if this file doesn't exist, build will fail — see fallback below

function ChatPage() {
  const { authUser } = authStore();

  const {
    chats,
    selectedChat,
    setSelectedChat,
    isFetchingChats,
    hasMore,
    page,
    limit,
    fetchChats,
    createGroupChat,
    accessChat,
    renameGroup,
    addToGroup,
    removeFromGroup,
    isRenamingGroup,
    isUpdatingGroup,
    deleteChat,
    isDeletingChat,
    // NEW: didLoadChats flag from store
    didLoadChats,
  } = chatstore();

  const {
    messagesByChat,
    fetchMessages,
    sendMessage,
    isSendingMessage,
    isFetchingMessages,
    markAsRead,
  } = messageStore();

  const findUser = userstore((state) => state.findUser);
  const userFound = userstore((state) => state.userFound);
  const isSearchingUser = userstore((state) => state.isSearchingUser);

  const [isCreatingGroup, setIsCreatingGroup] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [searchUserName, setSearchUserName] = useState("");
  const [selectedUsers, setSelectedUsers] = useState([]);

  const [isEditingGroup, setIsEditingGroup] = useState(false);

  // mobile: true = show sidebar, false = show chat window
  const [showSidebarOnMobile, setShowSidebarOnMobile] = useState(true);

  const activeMessagesEntry = selectedChat
    ? messagesByChat[selectedChat._id]
    : null;
  const messages = activeMessagesEntry?.data || [];

  // INITIAL LOAD: only attempt once (use didLoadChats to avoid loop when server returns data:[])
  useEffect(() => {
    if (!chats.length && !isFetchingChats && !didLoadChats) {
      fetchChats(1, limit);
    }
  }, [chats.length, isFetchingChats, didLoadChats, fetchChats, limit]);

  useEffect(() => {
    if (selectedChat && !messagesByChat[selectedChat._id]) {
      fetchMessages({ chatId: selectedChat._id, page: 1, limit: 50 });
      if (authUser?._id) {
        markAsRead({ chatId: selectedChat._id, userId: authUser._id });
      }
    }
  }, [selectedChat, messagesByChat, fetchMessages, markAsRead, authUser]);

  const sortedChats = useMemo(() => {
    return [...chats].sort((a, b) => {
      const aTime = new Date(a.updatedAt || a.createdAt || 0).getTime();
      const bTime = new Date(b.updatedAt || b.createdAt || 0).getTime();
      return bTime - aTime;
    });
  }, [chats]);

  const handleSelectChat = (chat) => {
    setSelectedChat(chat);
    setShowSidebarOnMobile(false); // go to messages on mobile
  };

  const handleLoadMoreChats = () => {
    if (hasMore && !isFetchingChats) {
      fetchChats(page + 1, limit);
    }
  };

  // optimistic send: create a temp local message before calling sendMessage
  const handleSendMessage = async (payload) => {
    // validate content
    if (payload?.content && typeof payload.content === "string") {
      if (!payload.content.trim()) return;
    }

    // Determine chatId for optimistic message
    const isFormData = payload instanceof FormData;
    const chatId = isFormData ? payload.get("chatId") : payload?.chatId;
    if (!chatId) {
      // nothing we can do
      await messageStore.getState().sendMessage(payload);
      return;
    }

    // Create temp id and temp message for optimistic UI
    const tempId = `temp-${Date.now()}`;

    // Build a lightweight temp message shape compatible with your store and UI
    const tempMessage = {
      _id: tempId,
      clientTempId: tempId,
      chat: { _id: chatId },
      chatId,
      content: payload?.content ?? (isFormData ? payload.get("content") : ""),
      sender: authUser || { _id: authUser?._id },
      messageType: payload?.messageType || (isFormData ? payload.get("messageType") : "text"),
      createdAt: new Date().toISOString(),
      readBy: [authUser?._id],
    };

    // Add clientTempId to payload if it's JSON so server can echo it back (optional)
    if (!isFormData && payload && typeof payload === "object") {
      payload.clientTempId = tempId;
    } else if (isFormData) {
      try {
        payload.append("clientTempId", tempId);
      } catch (e) {
        // some FormData wrappers might be immutable; ignore
      }
    }

    // Push local optimistic message
    messageStore.getState().addLocalMessage(tempMessage);

    // Now send to server (server response will be appended/reconciled by message.store)
    await messageStore.getState().sendMessage(payload);
  };

  const toggleUserInGroup = (user) => {
    const exists = selectedUsers.find((u) => u._id === user._id);
    if (exists) {
      setSelectedUsers((prev) => prev.filter((u) => u._id !== user._id));
    } else {
      setSelectedUsers((prev) => [...prev, user]);
    }
  };

  const handleCreateGroup = async ({ groupAvatar }) => {
    if (!groupName.trim() || selectedUsers.length === 0) return;
    const users = selectedUsers.map((u) => u._id);
    await createGroupChat({ name: groupName.trim(), users, groupAvatar });

    setIsCreatingGroup(false);
    setGroupName("");
    setSearchUserName("");
    setSelectedUsers([]);
  };

  const handleSelectChatFromUser = (user) => {
    if (!user) return;

    const existing = chats.find((chat) => {
      if (chat.isGroupChat || chat.isGroup) return false;
      const other = (chat.users || []).find((u) => u._id === user._id);
      return !!other;
    });

    if (existing) {
      setSelectedChat(existing);
      setShowSidebarOnMobile(false);
    } else if (accessChat) {
      accessChat(user._id);
      setShowSidebarOnMobile(false);
    } else {
      setSelectedChat(null);
    }
  };

  const handleOpenEditGroup = (chat) => {
    const target = chat || selectedChat;
    if (!target) return;

    const isGroup = target.isGroupChat || target.isGroup;
    if (!isGroup) return;

    setSelectedChat(target);
    setIsEditingGroup(true);
    setShowSidebarOnMobile(false);
  };

  const handleDeleteChat = (chat) => {
    const target = chat || selectedChat;
    if (!target?._id) return;

    deleteChat(target._id);

    if (selectedChat?._id === target._id) {
      setSelectedChat(null);
      setShowSidebarOnMobile(true);
    }
  };

  // -------------------------
  // Socket wiring effect
  // -------------------------
  const didSetupSocketRef = useRef(false);

  useEffect(() => {
    // choose a socket reference: prefer lib import, fallback to window.__socket
    const socket = (typeof socketFromLib !== "undefined" && socketFromLib) || (typeof window !== "undefined" && window.__socket);

    if (!socket) {
      // graceful: no socket available — skip
      // console.warn("socket not found: real-time disabled");
      return;
    }

    // guard to avoid double-subscribe (React strict mode)
    if (didSetupSocketRef.current) return;
    didSetupSocketRef.current = true;

    const onNewMessage = (payload) => {
      try {
        // payload is expected to be the message object with message.chat or message.chat._id
        messageStore.getState().pushIncomingMessage(payload);
        chatstore.getState().handleIncomingMessage(payload);
      } catch (err) {
        console.warn("onNewMessage handler error:", err);
      }
    };

    const onChatCreated = (payload) => {
      try {
        chatstore.getState().handleChatCreated(payload);
      } catch (err) {
        console.warn("onChatCreated handler error:", err);
      }
    };

    const onChatUpdated = (payload) => {
      try {
        chatstore.getState().handleChatUpdated(payload);
      } catch (err) {
        console.warn("onChatUpdated handler error:", err);
      }
    };

    const onChatDeleted = (payload) => {
      try {
        // payload might be { chatId } or chatId string
        const chatId = payload && (payload.chatId || payload);
        if (chatId) chatstore.getState().handleChatDeleted(chatId);
      } catch (err) {
        console.warn("onChatDeleted handler error:", err);
      }
    };

    const onAddedToGroup = (payload) => {
      try {
        // treat as chatUpdated (frontend will insert/move to top)
        chatstore.getState().handleChatUpdated(payload);
      } catch (err) {
        console.warn("onAddedToGroup handler error:", err);
      }
    };

    const onRemovedFromGroup = (payload) => {
      try {
        // payload could be { chatId, removedUserId } or populated chat
        if (payload && (payload.chatId || payload._id)) {
          const chatId = payload.chatId || payload._id;
          chatstore.getState().handleChatUpdated(payload);
          // if the current user was removed, server might also send chatDeleted; check
          if (payload.removedUserId && String(payload.removedUserId) === String(authUser?._id)) {
            chatstore.getState().handleChatDeleted(chatId);
          }
        }
      } catch (err) {
        console.warn("onRemovedFromGroup handler error:", err);
      }
    };

    socket.on("newMessage", onNewMessage);
    socket.on("chatCreated", onChatCreated);
    socket.on("chatUpdated", onChatUpdated);
    socket.on("chatDeleted", onChatDeleted);
    socket.on("addedToGroup", onAddedToGroup);
    socket.on("removedFromGroup", onRemovedFromGroup);

    return () => {
      try {
        socket.off("newMessage", onNewMessage);
        socket.off("chatCreated", onChatCreated);
        socket.off("chatUpdated", onChatUpdated);
        socket.off("chatDeleted", onChatDeleted);
        socket.off("addedToGroup", onAddedToGroup);
        socket.off("removedFromGroup", onRemovedFromGroup);
      } catch (e) {
        // ignore
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authUser]); // keep authUser so removedFromGroup check can compare ids

  return (
    <div className="h-[calc(100vh-5rem)] w-full max-w-6xl mx-auto rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl overflow-hidden flex flex-col shadow-2xl shadow-black/40">
      {/* Mobile top bar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-white/10 md:hidden">
        <button
          onClick={() => setShowSidebarOnMobile((prev) => !prev)}
          className="p-2 rounded-xl hover:bg-white/10 active:scale-95 transition"
        >
          <span className="sr-only">Toggle chat list</span>
          <div className="space-y-1">
            <span className="block w-5 h-0.5 bg-white" />
            <span className="block w-5 h-0.5 bg-white" />
            <span className="block w-5 h-0.5 bg-white" />
          </div>
        </button>

        <div className="text-xs font-medium text-white/80 truncate max-w-[60%]">
          {showSidebarOnMobile
            ? "Chats"
            : selectedChat?.chatName ||
              selectedChat?.groupName ||
              "Messages"}
        </div>

        <div className="w-8" />
      </div>

      {/* Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <div
          className={`${
            showSidebarOnMobile ? "flex" : "hidden"
          } md:flex w-full md:w-72 h-full`}
        >
          <ChatSidebar
            chats={sortedChats}
            selectedChat={selectedChat}
            onSelectChat={handleSelectChat}
            onLoadMore={handleLoadMoreChats}
            hasMore={hasMore}
            isFetchingChats={isFetchingChats}
            authUserId={authUser?._id}
            searchUserName={searchUserName}
            setSearchUserName={setSearchUserName}
            findUser={findUser}
            userFound={userFound}
            isSearchingUser={isSearchingUser}
            onUserClick={handleSelectChatFromUser}
            onOpenCreateGroup={() => setIsCreatingGroup(true)}
            onEditGroup={handleOpenEditGroup}
            onDeleteChat={handleDeleteChat}
          />
        </div>

        {/* Chat window */}
        <div
          className={`${
            showSidebarOnMobile ? "hidden" : "flex"
          } md:flex flex-1 h-full`}
        >
          <ChatWindow
            selectedChat={selectedChat}
            messages={messages}
            isFetchingMessages={isFetchingMessages}
            authUserId={authUser?._id}
            onSend={handleSendMessage}
            isSending={isSendingMessage}
            onEditGroup={handleOpenEditGroup}
            onDeleteChat={handleDeleteChat}
            isDeletingChat={isDeletingChat}
          />
        </div>
      </div>

      {isCreatingGroup && (
        <CreateGroupModal
          onClose={() => setIsCreatingGroup(false)}
          groupName={groupName}
          setGroupName={setGroupName}
          searchUserName={searchUserName}
          setSearchUserName={setSearchUserName}
          userFound={userFound}
          isSearchingUser={isSearchingUser}
          selectedUsers={selectedUsers}
          toggleUserInGroup={toggleUserInGroup}
          onCreate={handleCreateGroup}
          findUser={findUser}
        />
      )}

      {isEditingGroup && selectedChat && (
        <EditGroupModal
          onClose={() => setIsEditingGroup(false)}
          chat={selectedChat}
          authUserId={authUser?._id}
          searchUserName={searchUserName}
          setSearchUserName={setSearchUserName}
          userFound={userFound}
          isSearchingUser={isSearchingUser}
          findUser={findUser}
          renameGroup={renameGroup}
          addToGroup={addToGroup}
          removeFromGroup={removeFromGroup}
          isRenamingGroup={isRenamingGroup}
          isUpdatingGroup={isUpdatingGroup}
        />
      )}
    </div>
  );
}

export default ChatPage;
