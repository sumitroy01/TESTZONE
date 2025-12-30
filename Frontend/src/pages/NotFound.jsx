import { motion } from "framer-motion";

export default function NotFound({ onGoHome }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 overflow-hidden">
      
      {/* Glow */}
      <motion.div
        className="absolute w-[500px] h-[500px] bg-red-500/10 rounded-full blur-3xl"
        animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.5, 0.3] }}
        transition={{ duration: 6, repeat: Infinity }}
      />

      <div className="relative flex flex-col items-center gap-6 text-center">
        
        <motion.h1
          className="text-6xl font-bold text-white"
          initial={{ y: -10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
        >
          404
        </motion.h1>

        <motion.p
          className="text-slate-400 max-w-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          This page drifted into the void.
          <br />
          The link you followed doesn’t exist.
        </motion.p>

        <motion.button
          onClick={onGoHome}
          className="mt-4 px-5 py-2.5 rounded-xl bg-sky-500 text-white hover:bg-sky-400 transition"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          Go back home
        </motion.button>

        {/* Floating particles */}
        {[...Array(4)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-2 h-2 bg-slate-500 rounded-full"
            animate={{
              y: [0, -40, 0],
              opacity: [0.2, 0.6, 0.2],
            }}
            transition={{
              duration: 3 + i,
              repeat: Infinity,
            }}
            style={{
              left: `${30 + i * 40}px`,
              top: `${100 + i * 20}px`,
            }}
          />
        ))}
      </div>
    </div>
  );
}
