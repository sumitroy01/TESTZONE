import { useEffect, useMemo, useRef, useState } from "react";

import authStore from "../store/auth.store.js";
import chatstore from "../store/chat.store.js";
import userstore from "../store/user.store.js";
import messageStore from "../store/message.store.js";

import { getSocket } from "../socket.js";

import ChatSidebar from "../components/chat/ChatSidebar.jsx";
import ChatWindow from "../components/chat/ChatWindow.jsx";
import CreateGroupModal from "../components/chat/CreateGroupModal.jsx";
import EditGroupModal from "../components/chat/EditGroupModal.jsx";

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
  } = chatstore();

  const {
    messagesByChat,
    fetchMessages,
    isSendingMessage,
    isFetchingMessages,
  } = messageStore();

  const findUser = userstore((state) => state.findUser);
  const userFound = userstore((state) => state.userFound);
  const isSearchingUser = userstore((state) => state.isSearchingUser);

  const [isCreatingGroup, setIsCreatingGroup] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [searchUserName, setSearchUserName] = useState("");
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [isEditingGroup, setIsEditingGroup] = useState(false);

  // mobile
  const [showSidebarOnMobile, setShowSidebarOnMobile] = useState(true);

  const prevChatIdRef = useRef(null);

  const activeMessagesEntry = selectedChat
    ? messagesByChat[selectedChat._id]
    : null;
  const messages = activeMessagesEntry?.data || [];

  /* ---------------- fetch chats ---------------- */

  useEffect(() => {
    if (chats.length === 0 && !isFetchingChats) {
      fetchChats(1, limit);
    }
  }, [chats.length, fetchChats, limit, isFetchingChats]);

  /* ---------------- chat presence (IMPORTANT) ---------------- */

  useEffect(() => {
    const socket = getSocket();
    if (!socket || !authUser?._id) return;

    const currentChatId = selectedChat?._id;
    const prevChatId = prevChatIdRef.current;

    // close previous chat
    if (prevChatId && prevChatId !== currentChatId) {
      socket.emit("chat:close", { chatId: prevChatId });
    }

    // open current chat
    if (currentChatId) {
      socket.emit("chat:open", { chatId: currentChatId });

      // fetch messages once per chat
      if (!messagesByChat[currentChatId]) {
        fetchMessages({ chatId: currentChatId, page: 1, limit: 50 });
      }
    }

    prevChatIdRef.current = currentChatId;

    return () => {
      if (currentChatId) {
        socket.emit("chat:close", { chatId: currentChatId });
      }
    };
  }, [selectedChat?._id, authUser?._id]);

  /* ---------------- derived data ---------------- */

  const sortedChats = useMemo(() => {
    return [...chats].sort((a, b) => {
      const aTime = new Date(a.updatedAt || a.createdAt || 0).getTime();
      const bTime = new Date(b.updatedAt || b.createdAt || 0).getTime();
      return bTime - aTime;
    });
  }, [chats]);

  /* ---------------- handlers ---------------- */

  const handleSelectChat = (chat) => {
    setSelectedChat(chat);
    setShowSidebarOnMobile(false);
  };

  const handleLoadMoreChats = () => {
    if (hasMore && !isFetchingChats) {
      fetchChats(page + 1, limit);
    }
  };

  const handleSendMessage = async (payload) => {
    if (payload?.content && typeof payload.content === "string") {
      if (!payload.content.trim()) return;
    }
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

  /* ---------------- render ---------------- */

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
