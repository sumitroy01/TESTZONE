import { motion } from "framer-motion";

function LoggedOutHome({ onShowLogin, onShowSignup }) {
  return (
    <div className="min-h-[80vh] flex items-center justify-center px-6">
      <div className="grid lg:grid-cols-2 gap-12 items-center max-w-6xl w-full">

        {/* LEFT SIDE — TEXT */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="space-y-6"
        >
          <p className="uppercase tracking-[0.4em] text-sky-400 text-xs">
            Messaging, but better
          </p>

          <h1 className="text-4xl sm:text-5xl font-semibold leading-tight">
            Conversations that <br />
            <span className="text-sky-400">actually feel alive.</span>
          </h1>

          <p className="text-neutral-400 max-w-md">
            No noise. No clutter. Just smooth, real-time conversations that flow
            naturally — like talking in real life.
          </p>

          <div className="flex gap-4 pt-4">
            <button
              onClick={onShowSignup}
              className="px-5 py-2.5 rounded-xl bg-sky-500 text-white font-medium hover:bg-sky-400 transition"
            >
              Start chatting
            </button>

            <button
              onClick={onShowLogin}
              className="px-5 py-2.5 rounded-xl border border-white/20 text-white hover:bg-white/5 transition"
            >
              Login
            </button>
          </div>
        </motion.div>

        {/* RIGHT SIDE — FUN ANIMATION */}
        <div className="relative h-[320px] w-full">

          {/* Floating bubbles */}
          {[
            { text: "Hey 👋", x: 20, y: 40, delay: 0 },
            { text: "You there?", x: 180, y: 90, delay: 0.6 },
            { text: "Let’s build 🚀", x: 80, y: 180, delay: 1.2 },
             { text: "26 me duniya khatm hai  💣",x: 180, y: 90, delay:3},
          ].map((msg, i) => (
            <motion.div
              key={i}
              className="absolute bg-neutral-800 text-white px-4 py-2 rounded-2xl text-sm shadow-md"
              initial={{ opacity: 0, scale: 0.8, y: 20 }}
              animate={{
                opacity: [0, 1, 1, 0],
                y: [20, 0, 0, -20],
              }}
              transition={{
                duration: 3,
                delay: msg.delay,
                repeat: Infinity,
                repeatDelay: 1.5,
              }}
              style={{ left: msg.x, top: msg.y }}
            >
              {msg.text}
            </motion.div>
          ))}

          {/* Floating glow */}
          <motion.div
            className="absolute inset-0 rounded-full blur-3xl bg-sky-500/20"
            animate={{ opacity: [0.2, 0.4, 0.2] }}
            transition={{ duration: 4, repeat: Infinity }}
          />
        </div>
      </div>
    </div>
  );
}

export default LoggedOutHome;
