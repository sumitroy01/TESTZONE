import { motion } from "framer-motion";

const LoadingScreen = () => {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 overflow-hidden">
      <div className="relative w-[260px] h-[200px] flex items-center justify-center">

        {/* Soft glow */}
        <motion.div
          className="absolute inset-0 rounded-full bg-sky-500/20 blur-3xl"
          animate={{ opacity: [0.2, 0.4, 0.2] }}
          transition={{ duration: 3, repeat: Infinity }}
        />

        {/* Message bubbles */}
        {[
          { text: "Connecting…", x: -40, y: 10, delay: 0 },
          { text: "Syncing chats", x: 40, y: 50, delay: 0.8 },
          { text: "Almost there", x: -10, y: 90, delay: 1.6 },
        ].map((msg, i) => (
          <motion.div
            key={i}
            className="absolute bg-neutral-800 text-white px-4 py-2 rounded-2xl text-sm shadow-md"
            initial={{ opacity: 0, scale: 0.8, y: 10 }}
            animate={{
              opacity: [0, 1, 1, 0],
              y: [10, 0, 0, -10],
            }}
            transition={{
              duration: 2.5,
              delay: msg.delay,
              repeat: Infinity,
              repeatDelay: 1,
            }}
            style={{ left: msg.x, top: msg.y }}
          >
            {msg.text}
          </motion.div>
        ))}

        {/* Loading text */}
        <motion.p
          className="absolute bottom-0 text-sm text-slate-400"
          animate={{ opacity: [0.3, 1, 0.3] }}
          transition={{ duration: 1.8, repeat: Infinity }}
        >
          Loading experience…
        </motion.p>
      </div>
    </div>
  );
};

export default LoadingScreen;
