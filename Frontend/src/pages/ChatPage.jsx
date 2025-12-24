import { useEffect, useMemo, useState, useRef } from "react";

import authStore from "../store/auth.store.js";
import chatstore from "../store/chat.store.js";
import userstore from "../store/user.store.js";
import messageStore from "../store/message.store.js";

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

  // mobile
  const [showSidebarOnMobile, setShowSidebarOnMobile] = useState(true);

  const activeMessagesEntry = selectedChat
    ? messagesByChat[selectedChat._id]
    : null;
  const messages = activeMessagesEntry?.data || [];

  // -------------------------------
  // 1️⃣ Fetch chats
  // -------------------------------
  useEffect(() => {
    if (chats.length === 0 && !isFetchingChats) {
      fetchChats(1, limit);
    }
  }, [chats.length, isFetchingChats, fetchChats, limit]);

  // -------------------------------
  // 2️⃣ Fetch messages when chat changes
  // -------------------------------
  useEffect(() => {
    if (!selectedChat?._id) return;

    if (!messagesByChat[selectedChat._id]) {
      fetchMessages({
        chatId: selectedChat._id,
        page: 1,
        limit: 50,
      });
    }
  }, [selectedChat?._id, messagesByChat, fetchMessages]);

  // -------------------------------
  // 3️⃣ Mark messages as read + refetch (🔥 FIX)
  // -------------------------------
  useEffect(() => {
    if (!selectedChat?._id || !authUser?._id) return;

    const markAndRefresh = async () => {
      await markAsRead({
        chatId: selectedChat._id,
        userId: authUser._id,
      });

      // force UI update with fresh readBy
      await fetchMessages({
        chatId: selectedChat._id,
        page: 1,
        limit: 50,
      });
    };

    markAndRefresh();
  }, [selectedChat?._id, authUser?._id, markAsRead, fetchMessages]);

  // -------------------------------
  // Sorted chats
  // -------------------------------
  const sortedChats = useMemo(() => {
    return [...chats].sort((a, b) => {
      const aTime = new Date(a.updatedAt || a.createdAt || 0).getTime();
      const bTime = new Date(b.updatedAt || b.createdAt || 0).getTime();
      return bTime - aTime;
    });
  }, [chats]);

  // -------------------------------
  // Handlers
  // -------------------------------
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
    await sendMessage(payload);
  };

  const toggleUserInGroup = (user) => {
    const exists = selectedUsers.find((u) => u._id === user._id);
    setSelectedUsers((prev) =>
      exists ? prev.filter((u) => u._id !== user._id) : [...prev, user]
    );
  };

  const handleCreateGroup = async ({ groupAvatar }) => {
    if (!groupName.trim() || selectedUsers.length === 0) return;

    await createGroupChat({
      name: groupName.trim(),
      users: selectedUsers.map((u) => u._id),
      groupAvatar,
    });

    setIsCreatingGroup(false);
    setGroupName("");
    setSearchUserName("");
    setSelectedUsers([]);
  };

  const handleSelectChatFromUser = (user) => {
    if (!user) return;

    const existing = chats.find(
      (chat) =>
        !chat.isGroupChat &&
        (chat.users || []).some((u) => u._id === user._id)
    );

    if (existing) {
      setSelectedChat(existing);
    } else {
      accessChat(user._id);
    }

    setShowSidebarOnMobile(false);
  };

  const handleOpenEditGroup = (chat) => {
    const target = chat || selectedChat;
    if (!target?.isGroupChat) return;

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

  // -------------------------------
  // Render
  // -------------------------------
  return (
    <div className="h-[calc(100vh-5rem)] w-full max-w-6xl mx-auto rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl overflow-hidden flex flex-col shadow-2xl shadow-black/40">
      <div className="flex-1 flex overflow-hidden">
        <div
          className={`${
            showSidebarOnMobile ? "flex" : "hidden"
          } md:flex w-full md:w-72`}
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

        <div
          className={`${
            showSidebarOnMobile ? "hidden" : "flex"
          } md:flex flex-1`}
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
