import React from "react";
import { motion } from "motion/react";
import { Bot } from "lucide-react";

export default function TypingIndicator() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.3 }}
      className="flex gap-4 max-w-3xl mx-auto w-full justify-start items-start"
      id="ai-typing-indicator"
    >
      <div className="w-8 h-8 rounded-full bg-orange-500/10 border border-orange-500/20 flex-shrink-0 flex items-center justify-center mt-1">
        <Bot className="w-4 h-4 text-orange-400 animate-pulse" />
      </div>
      <div className="bg-white/5 backdrop-blur-sm border border-white/10 px-4 py-3 rounded-2xl rounded-tl-none max-w-[85%] sm:max-w-[75%] shadow-xl shadow-black/10">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5 h-6 px-1">
            <motion.span
              className="w-2 h-2 bg-orange-500 rounded-full"
              animate={{ y: [0, -6, 0] }}
              transition={{ duration: 0.8, repeat: Infinity, delay: 0 }}
            />
            <motion.span
              className="w-2 h-2 bg-orange-400 rounded-full"
              animate={{ y: [0, -6, 0] }}
              transition={{ duration: 0.8, repeat: Infinity, delay: 0.2 }}
            />
            <motion.span
              className="w-2 h-2 bg-orange-300 rounded-full"
              animate={{ y: [0, -6, 0] }}
              transition={{ duration: 0.8, repeat: Infinity, delay: 0.4 }}
            />
          </span>
          <span className="text-xs text-slate-400 font-medium select-none animate-pulse">
            Brackenfell Gas AI is typing...
          </span>
        </div>
      </div>
    </motion.div>
  );
}
