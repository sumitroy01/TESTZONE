import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

import authStore from "./store/auth.store";
import chatstore from "./store/chat.store";

import Navbar from "./components/Navbar";
import LoggedOutHome from "./pages/LoggedOutHome";
import ChatPage from "./pages/ChatPage";
import AuthPage from "./pages/AuthPage";
import ProfileSettings from "./pages/ProfileSettings";
import NotFound from "./pages/NotFound";

import { initSocket, getSocket } from "./socket";

/* ---------------- LOADING SCREEN ---------------- */

function FullScreenLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 overflow-hidden">
      <motion.div
        className="absolute w-[500px] h-[500px] bg-sky-500/10 rounded-full blur-3xl"
        animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.5, 0.3] }}
        transition={{ duration: 6, repeat: Infinity }}
      />

      <div className="relative flex flex-col items-center gap-6">
        <motion.div
          className="relative h-16 w-16 rounded-3xl bg-slate-900 flex items-center justify-center text-sm font-semibold text-white shadow-xl"
          animate={{ rotate: [0, 4, -4, 0], y: [0, -6, 0] }}
          transition={{ duration: 2.5, repeat: Infinity }}
        >
          chat
        </motion.div>

        {["Booting services", "Connecting sockets", "Syncing messages"].map(
          (text, i) => (
            <motion.div
              key={i}
              className="absolute text-xs text-slate-300 bg-slate-800 px-3 py-1.5 rounded-xl shadow-md"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: [0, 1, 1, 0], y: [10, 0, 0, -10] }}
              transition={{
                duration: 3,
                delay: i * 1.2,
                repeat: Infinity,
                repeatDelay: 1,
              }}
              style={{
                top: `${50 + i * 36}px`,
                left: i % 2 === 0 ? "-80px" : "80px",
              }}
            >
              {text}
            </motion.div>
          )
        )}

        <motion.div
          className="flex gap-1 pt-4"
          animate={{ opacity: [0.3, 1, 0.3] }}
          transition={{ duration: 1.5, repeat: Infinity }}
        >
          <span className="w-1.5 h-1.5 bg-slate-400 rounded-full" />
          <span className="w-1.5 h-1.5 bg-slate-400 rounded-full" />
          <span className="w-1.5 h-1.5 bg-slate-400 rounded-full" />
        </motion.div>

        <p className="text-xs text-slate-400 tracking-wide">
          Preparing your workspace…
        </p>
      </div>
    </div>
  );
}

/* ---------------- APP ---------------- */

function App() {
  const { authUser, isCheckingAuth, checkAuth, logOut } = authStore();
  const [showAuth, setShowAuth] = useState(false);
  const [authMode, setAuthMode] = useState("login");
  const [activeView, setActiveView] = useState("chat");

  /* --------- ROUTE CHECK --------- */
  const path = window.location.pathname;
  const isValidRoute = path === "/" || path === "";

  /* --------- AUTH BOOT --------- */
  useEffect(() => {
    checkAuth();

    return () => {
      try {
        const s = getSocket();
        if (s?.disconnect) s.disconnect();
      } catch {}
    };
  }, []);

  useEffect(() => {
    if (authUser) {
      const { fetchChats, page, limit } = chatstore.getState();
      fetchChats?.(page || 1, limit || 50);

      try {
        const backend =
          import.meta.env.VITE_BACKEND_URL || window.location.origin;

        initSocket(backend, authUser.token);
      } catch {}

      setShowAuth(false);
      setActiveView("chat");
    } else {
      try {
        const s = getSocket();
        if (s?.disconnect) s.disconnect();
      } catch {}

      setActiveView("chat");
    }
  }, [authUser]);

  /* --------- LOADING --------- */
  if (isCheckingAuth) return <FullScreenLoader />;

  const isLoggedIn = !!authUser;

  /* --------- RENDER --------- */
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white">
      <Navbar
        isLoggedIn={isLoggedIn}
        onLogout={logOut}
        onShowLogin={() => setShowAuth(true)}
        onShowSignup={() => {
          setAuthMode("signup");
          setShowAuth(true);
        }}
        onOpenSettings={() => setActiveView("settings")}
        onGoHome={() => setActiveView("chat")}
        activeView={activeView}
      />

      <main className="mx-auto max-w-6xl px-4 pb-8 pt-4">
        <AnimatePresence mode="wait">
          {!isValidRoute ? (
            <NotFound onGoHome={() => window.location.replace("/")} />
          ) : isLoggedIn ? (
            <motion.div
              key={activeView}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25 }}
            >
              {activeView === "chat" ? <ChatPage /> : <ProfileSettings />}
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
                onBackToLanding={() => setShowAuth(false)}
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
                onShowLogin={() => setShowAuth(true)}
                onShowSignup={() => {
                  setAuthMode("signup");
                  setShowAuth(true);
                }}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}

export default App;
