import { useEffect, useMemo, useRef, useState } from "react";

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

  /* ---------- refs ---------- */
  const readIntervalRef = useRef(null);

  /* ---------- stores ---------- */
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

  /* ---------- local UI state ---------- */
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

  useEffect(() => {
    if (!selectedChat || !authUser?._id) return;

    if (readIntervalRef.current) {
      clearInterval(readIntervalRef.current);
    }

    readIntervalRef.current = setInterval(() => {
      markAsRead({
        chatId: selectedChat._id,
        userId: authUser._id,
        silent: true,
      });
    }, 10_000);

    return () => {
      if (readIntervalRef.current) {
        clearInterval(readIntervalRef.current);
        readIntervalRef.current = null;
      }
    };
  }, [selectedChat, authUser, fetchMessages, markAsRead, messagesByChat]);

  /* ---------- sort chats ---------- */
  const sortedChats = useMemo(() => {
    return [...chats].sort((a, b) => {
      const aTime = new Date(a.updatedAt || a.createdAt || 0).getTime();
      const bTime = new Date(b.updatedAt || b.createdAt || 0).getTime();
      return bTime - aTime;
    });
  }, [chats]);

  /* ---------- handlers ---------- */

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
    setSelectedUsers((prev) =>
      prev.some((u) => u._id === user._id)
        ? prev.filter((u) => u._id !== user._id)
        : [...prev, user]
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

    const existing = chats.find((chat) => {
      if (chat.isGroupChat || chat.isGroup) return false;
      const users = chat.users || chat.allUsers || [];
      return users.some((u) => u._id === user._id);
    });

    if (existing) {
      setSelectedChat(existing);
    } else if (accessChat) {
      accessChat(user._id);
    }

    setShowSidebarOnMobile(false);
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
    setSelectedChat(null);
    setShowSidebarOnMobile(true);
  };

  /* ---------- UI ---------- */

  return (
    <div className="h-[calc(100vh-5rem)] w-full max-w-6xl mx-auto rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl overflow-hidden flex flex-col shadow-2xl shadow-black/40">
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <div
          className={`${showSidebarOnMobile ? "flex" : "hidden"} md:flex w-full md:w-72`}
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
          className={`${showSidebarOnMobile ? "hidden" : "flex"} md:flex flex-1`}
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
