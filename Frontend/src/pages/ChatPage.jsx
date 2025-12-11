import { useEffect, useMemo, useState, useRef } from "react";

import authStore from "../store/auth.store.js";
import chatstore from "../store/chat.store.js";
import userstore from "../store/user.store.js";
import messageStore from "../store/message.store.js";

import ChatSidebar from "../components/chat/ChatSidebar.jsx";
import ChatWindow from "../components/chat/ChatWindow.jsx";
import CreateGroupModal from "../components/chat/CreateGroupModal.jsx";
import EditGroupModal from "../components/chat/EditGroupModal.jsx";

import { getSocket } from "../lib/socket.js";

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
  const [showSidebarOnMobile, setShowSidebarOnMobile] = useState(true);

  const activeMessagesEntry = selectedChat
    ? messagesByChat[selectedChat._id]
    : null;

  const messages = activeMessagesEntry?.data || [];

  // --------------------------
  // Initial fetch of chats
  // --------------------------
  useEffect(() => {
    if (!chats.length && !isFetchingChats && !didLoadChats) {
      fetchChats(1, limit);
    }
  }, [chats.length, isFetchingChats, didLoadChats, fetchChats, limit]);

  // --------------------------
  // Fetch messages when chat changes
  // --------------------------
  useEffect(() => {
    if (selectedChat && !messagesByChat[selectedChat._id]) {
      fetchMessages({ chatId: selectedChat._id, page: 1, limit: 50 });

      if (authUser?._id) {
        markAsRead({
          chatId: selectedChat._id,
          userId: authUser._id,
        });
      }
    }
  }, [selectedChat, messagesByChat, fetchMessages, markAsRead, authUser]);

  // sort chats by latest message
  const sortedChats = useMemo(() => {
    return [...chats].sort((a, b) => {
      const aTime = new Date(a.updatedAt || a.createdAt || 0).getTime();
      const bTime = new Date(b.updatedAt || b.createdAt || 0).getTime();
      return bTime - aTime;
    });
  }, [chats]);

  // --------------------------
  // Selecting a chat
  // --------------------------
  const handleSelectChat = (chat) => {
    setSelectedChat(chat);
    setShowSidebarOnMobile(false);
  };

  const handleLoadMoreChats = () => {
    if (hasMore && !isFetchingChats) {
      fetchChats(page + 1, limit);
    }
  };

  // --------------------------
  // Sending a message (optimistic)
  // --------------------------
  const handleSendMessage = async (payload) => {
    if (payload?.content && typeof payload.content === "string") {
      if (!payload.content.trim()) return;
    }

    const isFormData = payload instanceof FormData;
    const chatId = isFormData ? payload.get("chatId") : payload?.chatId;

    if (!chatId) {
      await sendMessage(payload);
      return;
    }

    const tempId = `temp-${Date.now()}`;
    const tempMessage = {
      _id: tempId,
      clientTempId: tempId,
      chat: { _id: chatId },
      chatId,
      content:
        payload?.content ??
        (isFormData ? payload.get("content") : ""),
      sender: authUser || { _id: authUser?._id },
      messageType:
        payload?.messageType ||
        (isFormData ? payload.get("messageType") : "text"),
      createdAt: new Date().toISOString(),
      readBy: [authUser?._id],
    };

    if (!isFormData) {
      payload.clientTempId = tempId;
    } else {
      try {
        payload.append("clientTempId", tempId);
      } catch {}
    }

    messageStore.getState().addLocalMessage(tempMessage);

    await sendMessage(payload);
  };

  // --------------------------
  // Group handling
  // --------------------------
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

    await createGroupChat({
      name: groupName.trim(),
      users,
      groupAvatar,
    });

    setIsCreatingGroup(false);
    setGroupName("");
    setSearchUserName("");
    setSelectedUsers([]);
  };

  const handleSelectChatFromUser = (user) => {
    if (!user) return;

    const existing = chats.find((chat) => {
      if (chat.isGroupChat || chat.isGroup) return false;
      return chat.users?.some((u) => u._id === user._id);
    });

    if (existing) {
      setSelectedChat(existing);
      setShowSidebarOnMobile(false);
    } else if (accessChat) {
      accessChat(user._id);
      setShowSidebarOnMobile(false);
    }
  };

  const handleOpenEditGroup = (chat) => {
    const target = chat || selectedChat;
    if (!target) return;
    if (!(target.isGroupChat || target.isGroup)) return;

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

  // --------------------------
  // FINAL FIXED SOCKET LOGIC
  // --------------------------
  const didSetupSocketRef = useRef(false);

  useEffect(() => {
    // Ensure this effect runs ONLY once (even in Strict Mode)
    if (didSetupSocketRef.current) return;

    let socket = getSocket();
    if (!socket && typeof window !== "undefined") {
      socket = window.__socket;
    }

    if (!socket || typeof socket.on !== "function") {
      console.warn("No valid socket instance found.");
      return;
    }

    didSetupSocketRef.current = true;
    console.log("📡 Socket listeners attached once");

    const onNewMessage = (payload) => {
      try {
        messageStore.getState().pushIncomingMessage(payload);
        chatstore.getState().handleIncomingMessage(payload);
      } catch {}
    };

    const onChatCreated = (payload) => {
      chatstore.getState().handleChatCreated(payload);
    };

    const onChatUpdated = (payload) => {
      chatstore.getState().handleChatUpdated(payload);
    };

    const onChatDeleted = (payload) => {
      const chatId = payload?.chatId || payload;
      chatstore.getState().handleChatDeleted(chatId);
    };

    const onAddedToGroup = (payload) => {
      chatstore.getState().handleChatUpdated(payload);
    };

    const onRemovedFromGroup = (payload) => {
      const chatId = payload?.chatId || payload?._id;
      chatstore.getState().handleChatUpdated(payload);

      if (
        payload?.removedUserId &&
        String(payload.removedUserId) === String(authUser?._id)
      ) {
        chatstore.getState().handleChatDeleted(chatId);
      }
    };

    socket.on("newMessage", onNewMessage);
    socket.on("chatCreated", onChatCreated);
    socket.on("chatUpdated", onChatUpdated);
    socket.on("chatDeleted", onChatDeleted);
    socket.on("addedToGroup", onAddedToGroup);
    socket.on("removedFromGroup", onRemovedFromGroup);

  }, []); // <-- EMPTY DEPS = runs only once ALWAYS

  // --------------------------
  // UI
  // --------------------------
  return (
    <div className="h-[calc(100vh-5rem)] w-full max-w-6xl mx-auto rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl overflow-hidden flex flex-col shadow-2xl shadow-black/40">

      {/* Mobile top bar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-white/10 md:hidden">
        <button
          onClick={() => setShowSidebarOnMobile((prev) => !prev)}
          className="p-2 rounded-xl hover:bg-white/10 active:scale-95 transition"
        >
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
