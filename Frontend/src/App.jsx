import { useEffect, useState } from "react";
import { Toaster } from "react-hot-toast";
import { motion, AnimatePresence } from "framer-motion";

import authStore from "./store/auth.store.js";
import chatstore from "./store/chat.store.js";

import Navbar from "./components/Navbar";
import LoggedOutHome from "./pages/LoggedOutHome";
import ChatPage from "./pages/ChatPage";
import AuthPage from "./pages/AuthPage.jsx";
import ProfileSettings from "./pages/ProfileSettings.jsx";

import { initSocket, getSocket } from "./socket.js";
import { registerSocketListeners } from "./lib/socket-listeners";

/* ---------------- Loader ---------------- */

function FullScreenLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      <div className="flex flex-col items-center gap-4">
        <div className="relative h-14 w-14">
          <motion.div
            className="absolute inset-0 rounded-3xl bg-sky-500/80 blur-sm"
            animate={{ scale: [1, 1.1, 1], opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 1.4, repeat: Infinity }}
          />
          <motion.div
            className="absolute inset-1 rounded-3xl bg-slate-900 flex items-center justify-center text-xs font-semibold"
            animate={{ rotate: [0, 4, -4, 0] }}
            transition={{ duration: 1.6, repeat: Infinity }}
          >
            chat
          </motion.div>
        </div>
        <p className="text-sm text-neutral-300">
          Preparing your workspace...
        </p>
      </div>
    </div>
  );
}

/* ---------------- App ---------------- */

function App() {
  const { authUser, isCheckingAuth, checkAuth, logOut } = authStore();

  const [showAuth, setShowAuth] = useState(false);
  const [authMode, setAuthMode] = useState("login");
  const [activeView, setActiveView] = useState("chat");

  /* ---- BOOT: check auth once ---- */
  useEffect(() => {
    checkAuth();

    return () => {
      try {
        const s = getSocket();
        if (s?.disconnect) s.disconnect();
      } catch {}
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---- AUTH CHANGE EFFECT ---- */
  useEffect(() => {
    if (authUser) {
      // fetch chats
      const { fetchChats, page, limit } = chatstore.getState();
      if (typeof fetchChats === "function") {
        fetchChats(page || 1, limit || 50).catch(() => {});
      }

      setShowAuth(false);
      setActiveView("chat");

      // init socket
      try {
        const backend =
          import.meta.env.VITE_BACKEND_URL || window.location.origin;
        initSocket(backend);

        setTimeout(() => {
          try {
            registerSocketListeners();
          } catch {}
        }, 50);
      } catch {}
    } else {
      // logout cleanup
      try {
        const s = getSocket();
        if (s?.disconnect) s.disconnect();
      } catch {}

      setActiveView("chat");
    }
  }, [authUser]);

  /* ---- UI helpers ---- */
  const openAuth = (mode) => {
    setAuthMode(mode);
    setShowAuth(true);
  };

  const backToLanding = () => {
    setShowAuth(false);
  };

  /* ---- LOADING ---- */
  if (isCheckingAuth) {
    return (
      <>
        <FullScreenLoader />
      </>
    );
  }

  const isLoggedIn = !!authUser;

  /* ---- RENDER ---- */
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white">
      <Navbar
        isLoggedIn={isLoggedIn}
        onLogout={logOut}
        onShowLogin={() => openAuth("login")}
        onShowSignup={() => openAuth("signup")}
        onOpenSettings={() => setActiveView("settings")}
        onGoHome={() => setActiveView("chat")}
        activeView={activeView}
      />

      <main className="mx-auto max-w-6xl px-4 pb-8 pt-4">
        <AnimatePresence mode="wait">
          {isLoggedIn ? (
            <motion.div
              key={activeView}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25 }}
            >
              {activeView === "chat" ? (
                <ChatPage />
              ) : (
                <ProfileSettings />
              )}
            </motion.div>
          ) : showAuth ? (
            <motion.div
              key="auth"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25 }}
            >
              <AuthPage
                initialMode={authMode}
                onBackToLanding={backToLanding}
              />
            </motion.div>
          ) : (
            <motion.div
              key="landing"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25 }}
            >
              <LoggedOutHome
                onShowLogin={() => openAuth("login")}
                onShowSignup={() => openAuth("signup")}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* <Toaster position="top-right" /> */}
    </div>
  );
}

export default App;
