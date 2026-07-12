import React, { useState, useRef, useEffect } from "react";
import { Send, User, Bot, Loader2, Flame, Phone, Menu, Plus, Trash2, MessageSquare, LogOut, X, History } from "lucide-react";
import Markdown from "react-markdown";
import { motion, AnimatePresence } from "motion/react";
import { Message } from "../types";
import { cn } from "../lib/utils";
import { initAuth, googleSignIn, createChatSession, appendMessageToSession, getUserChatSessions, deleteChatSession, logout } from "../lib/firebase";
import { appendUserDetailsToSheet } from "../lib/sheets";
import TypingIndicator from "./TypingIndicator";

export default function ChatUI() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Auth & Onboarding State
  const [needsAuth, setNeedsAuth] = useState(true);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [phone, setPhone] = useState("");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [showPhoneStep, setShowPhoneStep] = useState(false);

  // Chat History Sidebar States
  const [previousSessions, setPreviousSessions] = useState<any[]>([]);
  const [isLoadingSessions, setIsLoadingSessions] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  useEffect(() => {
    initAuth(
      async (u) => {
        setUser(u);
        setNeedsAuth(false);
        if (u.email) {
          setIsLoadingSessions(true);
          try {
            const userSessions = await getUserChatSessions(u.email);
            setPreviousSessions(userSessions);
            if (userSessions.length > 0) {
              // Automatically load the latest session
              const latestSession = userSessions[0];
              setSessionId(latestSession.id);
              setMessages(latestSession.messages || []);
              if (latestSession.userDetails?.phone) {
                setPhone(latestSession.userDetails.phone);
              }
              setShowPhoneStep(false);
            } else {
              setShowPhoneStep(true);
            }
          } catch (err) {
            console.error("Error loading previous sessions:", err);
            setShowPhoneStep(true);
          } finally {
            setIsLoadingSessions(false);
          }
        }
      },
      () => {
        setNeedsAuth(true);
        setUser(null);
        setPreviousSessions([]);
      }
    );
  }, []);

  const handleLogin = async () => {
    setIsLoggingIn(true);
    try {
      const result = await googleSignIn();
      if (result && result.user) {
        setUser(result.user);
        setNeedsAuth(false);
        if (result.user.email) {
          setIsLoadingSessions(true);
          try {
            const userSessions = await getUserChatSessions(result.user.email);
            setPreviousSessions(userSessions);
            if (userSessions.length > 0) {
              const latestSession = userSessions[0];
              setSessionId(latestSession.id);
              setMessages(latestSession.messages || []);
              if (latestSession.userDetails?.phone) {
                setPhone(latestSession.userDetails.phone);
              }
              setShowPhoneStep(false);
            } else {
              setShowPhoneStep(true);
            }
          } catch (err) {
            console.error("Error loading sessions after login:", err);
            setShowPhoneStep(true);
          } finally {
            setIsLoadingSessions(false);
          }
        }
      }
    } catch (err) {
      console.error('Login failed:', err);
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleStartChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone.trim()) return;
    
    setIsLoading(true);
    const userDetails = {
      name: user?.displayName || 'Unknown',
      email: user?.email || 'Unknown',
      phone: phone.trim()
    };
    
    const newSessionId = await createChatSession(userDetails);
    if (newSessionId) {
      setSessionId(newSessionId);
      const newSessionObj = {
        id: newSessionId,
        userDetails,
        createdAt: new Date().toISOString(),
        messages: []
      };
      setPreviousSessions((prev) => [newSessionObj, ...prev]);
    }
    
    appendUserDetailsToSheet(userDetails).catch(console.error);
    setShowPhoneStep(false);
    setNeedsAuth(false);
    setIsLoading(false);
  };

  const handleLogout = async () => {
    if (window.confirm("Are you sure you want to sign out?")) {
      try {
        await logout();
        setUser(null);
        setSessionId(null);
        setMessages([]);
        setPhone("");
        setPreviousSessions([]);
        setNeedsAuth(true);
        setShowPhoneStep(false);
      } catch (err) {
        console.error("Logout failed:", err);
      }
    }
  };

  const selectSession = (session: any) => {
    setSessionId(session.id);
    setMessages(session.messages || []);
    if (session.userDetails?.phone) {
      setPhone(session.userDetails.phone);
    }
    setShowPhoneStep(false);
    setNeedsAuth(false);
    setIsSidebarOpen(false);
  };

  const handleNewChat = () => {
    setSessionId(null);
    setMessages([]);
    if (phone) {
      setShowPhoneStep(false);
    } else {
      setShowPhoneStep(true);
    }
    setIsSidebarOpen(false);
  };

  const handleDeleteSession = async (e: React.MouseEvent, sId: string) => {
    e.stopPropagation();
    if (window.confirm("Are you sure you want to delete this conversation?")) {
      const success = await deleteChatSession(sId);
      if (success) {
        setPreviousSessions((prev) => prev.filter((s) => s.id !== sId));
        if (sessionId === sId) {
          const remaining = previousSessions.filter((s) => s.id !== sId);
          if (remaining.length > 0) {
            selectSession(remaining[0]);
          } else {
            handleNewChat();
          }
        }
      }
    }
  };

  const formatSessionDate = (session: any) => {
    if (!session.createdAt) return "New Conversation";
    let date: Date;
    if (session.createdAt.toDate) {
      date = session.createdAt.toDate();
    } else {
      date = new Date(session.createdAt);
    }
    
    if (isNaN(date.getTime())) return "Chat Session";
    
    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getSessionTitle = (session: any) => {
    if (session.messages && session.messages.length > 0) {
      const firstMsg = session.messages[0].content;
      return firstMsg.length > 25 ? firstMsg.slice(0, 25) + "..." : firstMsg;
    }
    return "New Conversation";
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const sendMessage = async (textToSend: string) => {
    if (!textToSend.trim() || isLoading) return;

    if (textToSend === "Visit Website") {
      window.open("https://brackenfellgas.co.za", "_blank");
      return;
    }

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: textToSend.trim(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setIsLoading(true);

    let currentSessionId = sessionId;
    if (!currentSessionId) {
      const userDetails = {
        name: user?.displayName || 'Unknown',
        email: user?.email || 'Unknown',
        phone: phone || 'Unknown'
      };
      const newSessionId = await createChatSession(userDetails);
      if (newSessionId) {
        currentSessionId = newSessionId;
        setSessionId(newSessionId);
        const newSessionObj = {
          id: newSessionId,
          userDetails,
          createdAt: new Date().toISOString(),
          messages: [userMessage]
        };
        setPreviousSessions((prev) => [newSessionObj, ...prev]);
      } else {
        console.error("Failed to initialize session.");
      }
    } else {
      appendMessageToSession(currentSessionId, "user", textToSend.trim()).catch(console.error);
    }

    const assistantMessageId = (Date.now() + 1).toString();
    setMessages((prev) => [
      ...prev,
      { id: assistantMessageId, role: "assistant", content: "" },
    ]);

    try {
      const history = messages;

      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          history,
          message: userMessage.content,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorMsg = "Failed to connect to the server";
        try {
          const errorJson = JSON.parse(errorText);
          if (errorJson.error) errorMsg = errorJson.error;
        } catch (e) {
          // Ignore
        }
        throw new Error(errorMsg);
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder("utf-8");

      if (!reader) throw new Error("No reader available");

      let done = false;
      let buffer = "";
      let fullAssistantText = "";

      while (!done) {
        const { value, done: readerDone } = await reader.read();
        done = readerDone;
        if (value) {
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          
          buffer = lines.pop() || "";
          
          for (const line of lines) {
            if (line.startsWith("data: ")) {
              const dataStr = line.slice(6);
              if (dataStr.trim() === "[DONE]") {
                done = true;
                break;
              }
              try {
                const data = JSON.parse(dataStr);
                fullAssistantText += data.text;
                setMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === assistantMessageId
                      ? { ...msg, content: fullAssistantText }
                      : msg
                  )
                );
              } catch (e) {
                console.error("Error parsing SSE JSON", e);
              }
            }
          }
        }
      }

      if (currentSessionId && fullAssistantText) {
        appendMessageToSession(currentSessionId, "assistant", fullAssistantText).catch(console.error);
        
        // Update local previousSessions state so the titles list is instantly updated in sidebar
        setPreviousSessions((prev) => 
          prev.map((s) => s.id === currentSessionId 
            ? { 
                ...s, 
                messages: [
                  ...(s.messages || []).filter((m: any) => m.id !== userMessage.id),
                  userMessage,
                  { role: "assistant", content: fullAssistantText }
                ]
              } 
            : s
          )
        );
      }

    } catch (error: any) {
      console.error("Chat error:", error);
      setMessages((prev) => [
        ...prev.filter(m => m.id !== assistantMessageId),
        {
          id: Date.now().toString(),
          role: "assistant",
          content: error.message || "Sorry, I encountered an error. Please try again later.",
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    const textToSend = input;
    setInput("");
    await sendMessage(textToSend);
  };

  if (needsAuth || showPhoneStep) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-[#0f172a] text-white overflow-hidden relative font-sans p-6">
        <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
          <div className="absolute -top-[10%] -left-[10%] w-[50%] h-[50%] bg-orange-600/20 rounded-full blur-[120px]"></div>
          <div className="absolute top-[40%] -right-[10%] w-[60%] h-[60%] bg-blue-600/20 rounded-full blur-[150px]"></div>
          <div className="absolute -bottom-[10%] left-[20%] w-[40%] h-[40%] bg-cyan-500/10 rounded-full blur-[100px]"></div>
        </div>

        <div className="bg-white/10 backdrop-blur-xl border border-white/10 p-8 rounded-3xl w-full max-w-md relative z-10 shadow-2xl flex flex-col items-center">
          <div className="w-16 h-16 bg-orange-500 rounded-2xl flex items-center justify-center shadow-lg shadow-orange-500/30 mb-6">
            <Flame className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-center mb-2">Welcome to Brackenfell Gas</h1>
          <p className="text-slate-400 text-center mb-8 text-sm">Please provide your details to connect with our support team and save your chat.</p>
          
          {showPhoneStep ? (
            <form onSubmit={handleStartChat} className="w-full flex flex-col gap-4">
              <p className="text-sm text-center text-slate-300">Signed in as {user?.email}</p>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Phone className="h-5 w-5 text-slate-400" />
                </div>
                <input
                  type="tel"
                  required
                  placeholder="Your Phone Number"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50 transition-all"
                />
              </div>
              <button
                type="submit"
                disabled={!phone.trim() || isLoading}
                className="w-full py-3 bg-orange-500 hover:bg-orange-600 text-white font-medium rounded-xl shadow-lg shadow-orange-500/20 transition-all focus:outline-none focus:ring-2 focus:ring-orange-500 disabled:opacity-50 flex items-center justify-center"
              >
                {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Start Chat"}
              </button>
            </form>
          ) : (
            <button 
              onClick={handleLogin}
              disabled={isLoggingIn}
              className="w-full py-3 bg-white hover:bg-gray-50 text-gray-900 font-medium rounded-xl flex items-center justify-center gap-3 transition-colors disabled:opacity-70"
            >
              {isLoggingIn ? (
                <Loader2 className="w-5 h-5 animate-spin text-gray-500" />
              ) : (
                <>
                  <svg viewBox="0 0 48 48" className="w-6 h-6">
                    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
                    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
                    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
                    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
                    <path fill="none" d="M0 0h48v48H0z"></path>
                  </svg>
                  Continue with Google
                </>
              )}
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-[#0f172a] text-white overflow-hidden relative font-sans">
      {/* Frosted Glass Background Blobs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute -top-[10%] -left-[10%] w-[50%] h-[50%] bg-orange-600/20 rounded-full blur-[120px]"></div>
        <div className="absolute top-[40%] -right-[10%] w-[60%] h-[60%] bg-blue-600/20 rounded-full blur-[150px]"></div>
        <div className="absolute -bottom-[10%] left-[20%] w-[40%] h-[40%] bg-cyan-500/10 rounded-full blur-[100px]"></div>
      </div>

      {/* Sidebar - Desktop and Mobile Overlay Drawer */}
      <div
        className={cn(
          "fixed inset-y-0 left-0 z-30 w-72 bg-[#0b0f19]/95 backdrop-blur-2xl border-r border-white/10 flex flex-col transition-transform duration-300 transform md:relative md:translate-x-0 shrink-0",
          isSidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Sidebar Header */}
        <div className="p-4 border-b border-white/10 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <History className="w-5 h-5 text-orange-500" />
            <span className="font-bold text-xs tracking-wider uppercase text-slate-300">Conversation History</span>
          </div>
          <button
            onClick={() => setIsSidebarOpen(false)}
            className="p-1 hover:bg-white/10 rounded-lg md:hidden text-slate-400 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* New Chat Button */}
        <div className="p-4 shrink-0">
          <button
            onClick={handleNewChat}
            className="w-full py-2.5 px-4 bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold rounded-xl shadow-lg shadow-orange-500/10 flex items-center justify-center gap-2 transition-all"
          >
            <Plus className="w-4 h-4" />
            New Chat
          </button>
        </div>

        {/* Previous Chat Sessions list */}
        <div className="flex-1 overflow-y-auto px-2 space-y-1 py-1">
          {isLoadingSessions ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-500 gap-2">
              <Loader2 className="w-5 h-5 animate-spin text-orange-500" />
              <span className="text-xs font-medium">Loading history...</span>
            </div>
          ) : previousSessions.length === 0 ? (
            <div className="text-center py-12 text-slate-500 text-xs px-4 leading-relaxed">
              No previous conversations found. Click "+ New Chat" to start an assistant conversation!
            </div>
          ) : (
            previousSessions.map((session) => {
              const isActive = session.id === sessionId;
              return (
                <div
                  key={session.id}
                  onClick={() => selectSession(session)}
                  className={cn(
                    "group w-full flex items-center justify-between p-3 rounded-xl cursor-pointer text-left transition-all border",
                    isActive
                      ? "bg-orange-500/10 border-orange-500/30 text-white"
                      : "hover:bg-white/5 border-transparent text-slate-300 hover:text-white"
                  )}
                >
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <MessageSquare className={cn("w-4 h-4 shrink-0", isActive ? "text-orange-400" : "text-slate-400")} />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold truncate leading-normal">
                        {getSessionTitle(session)}
                      </p>
                      <p className="text-[10px] text-slate-500 mt-0.5 truncate font-mono">
                        {formatSessionDate(session)}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={(e) => handleDeleteSession(e, session.id)}
                    className="p-1 hover:bg-red-500/20 text-slate-500 group-hover:opacity-100 opacity-0 md:opacity-0 md:group-hover:opacity-100 hover:text-red-400 rounded-md transition-all shrink-0 ml-1"
                    title="Delete Conversation"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })
          )}
        </div>

        {/* Sidebar Footer with user account info */}
        {user && (
          <div className="p-4 border-t border-white/10 bg-black/30 flex flex-col gap-3 shrink-0">
            <div className="flex items-center gap-3">
              {user.photoURL ? (
                <img
                  src={user.photoURL}
                  referrerPolicy="no-referrer"
                  alt={user.displayName}
                  className="w-8 h-8 rounded-full border border-white/10"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-orange-500/20 flex items-center justify-center border border-orange-500/30">
                  <User className="w-4 h-4 text-orange-400" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold truncate leading-none text-slate-200">{user.displayName || "Support User"}</p>
                <p className="text-[10px] text-slate-500 truncate mt-1">{user.email}</p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="w-full py-2 px-3 border border-white/10 hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/20 text-slate-400 text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5 transition-all"
            >
              <LogOut className="w-3.5 h-3.5" />
              Sign Out
            </button>
          </div>
        )}
      </div>

      {/* Backdrop overlay for mobile sidebar */}
      {isSidebarOpen && (
        <div
          onClick={() => setIsSidebarOpen(false)}
          className="fixed inset-0 z-25 bg-black/60 md:hidden backdrop-blur-sm"
        />
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-full overflow-hidden relative">
        {/* Header */}
        <header className="bg-white/5 backdrop-blur-md border-b border-white/10 px-4 sm:px-6 py-4 flex items-center justify-between shrink-0 relative z-10">
          <div className="flex items-center gap-3">
            {/* Sidebar toggle button (Mobile Only) */}
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="p-2 bg-white/5 border border-white/10 rounded-xl md:hidden hover:bg-white/10 transition-colors text-slate-200"
              title="View Chat History"
            >
              <Menu className="w-5 h-5" />
            </button>

            <div className="w-10 h-10 bg-orange-500 rounded-lg flex items-center justify-center shadow-lg shadow-orange-500/20">
              <Flame className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-base sm:text-lg font-bold leading-none">Brackenfell</h1>
              <p className="text-[10px] sm:text-xs text-orange-400 font-medium tracking-widest uppercase mt-1">Gas Support</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <a
              href="https://wa.me/27741021125"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 bg-green-500/20 hover:bg-green-500/30 text-green-400 border border-green-500/30 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
            >
              <Phone className="w-3.5 h-3.5" />
              WhatsApp Us
            </a>
          </div>
        </header>

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 relative z-10">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center space-y-4 max-w-md mx-auto relative z-10">
              <div className="bg-white/10 p-4 rounded-full shadow-lg shadow-white/5 border border-white/10">
                <Bot className="w-10 h-10 text-orange-400" />
              </div>
              <h2 className="text-2xl font-medium text-white">How can we help?</h2>
              <p className="text-slate-400 text-sm">
                Ask us about gas deliveries, product availability, or any other
                services at Brackenfell Gas.
              </p>
            </div>
          )}

          {messages.map((message) => {
            if (message.role === "assistant" && !message.content) {
              return <TypingIndicator key={message.id} />;
            }
            return (
              <div
                key={message.id}
                className={cn(
                  "flex gap-4 max-w-3xl mx-auto w-full animate-fade-in",
                  message.role === "user" ? "justify-end" : "justify-start"
                )}
              >
                {message.role === "assistant" && (
                  <div className="w-8 h-8 rounded-full bg-white/20 flex-shrink-0 flex items-center justify-center mt-1">
                    <Bot className="w-4 h-4 text-white" />
                  </div>
                )}
                <div
                  className={cn(
                    "px-4 py-3 rounded-2xl max-w-[85%] sm:max-w-[75%] shadow-md",
                    message.role === "user"
                      ? "bg-orange-500/20 backdrop-blur-sm border border-orange-500/20 text-white rounded-tr-none"
                      : "bg-white/5 backdrop-blur-sm border border-white/10 text-slate-200 rounded-tl-none"
                  )}
                >
                  {message.role === "user" ? (
                    <p className="whitespace-pre-wrap text-sm leading-relaxed">{message.content}</p>
                  ) : (
                    <div className="markdown-body prose prose-invert prose-sm sm:prose-base prose-orange max-w-none break-words leading-relaxed">
                      <Markdown>{message.content}</Markdown>
                    </div>
                  )}
                </div>
                {message.role === "user" && (
                  <div className="w-8 h-8 rounded-full bg-orange-500 flex-shrink-0 flex items-center justify-center mt-1">
                    <User className="w-4 h-4 text-white" />
                  </div>
                )}
              </div>
            );
          })}
          <div ref={messagesEndRef} className="h-px" />
        </div>

        {/* Input Area */}
        <footer className="p-4 sm:p-6 bg-white/5 backdrop-blur-xl border-t border-white/10 shrink-0 relative z-10">
          <form
            onSubmit={handleSubmit}
            className="max-w-3xl mx-auto flex items-end gap-3"
          >
            <div className="relative flex-1 bg-white/5 border border-white/10 rounded-xl focus-within:ring-2 focus-within:ring-orange-500/50 transition-shadow">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSubmit(e);
                  }
                }}
                placeholder="Type your request here..."
                className="w-full max-h-32 min-h-[44px] bg-transparent resize-none py-3 px-4 text-sm outline-none text-white placeholder:text-slate-500"
                rows={1}
              />
            </div>
            <button
              type="submit"
              disabled={!input.trim() || isLoading}
              className="h-11 w-11 flex items-center justify-center rounded-xl bg-orange-500 text-white hover:bg-orange-600 shadow-lg shadow-orange-500/20 transition-all focus:outline-none focus:ring-2 focus:ring-orange-500 disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
            >
              {isLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Send className="w-5 h-5 ml-0.5" />
              )}
            </button>
          </form>
          <div className="max-w-3xl mx-auto flex flex-wrap gap-2 mt-4 justify-center">
            {[
              "Check Gas Prices",
              "Book Delivery",
              "Store Hours",
              "LPG Installations",
              "Visit Website",
            ].map((action) => (
              <button
                key={action}
                type="button"
                onClick={() => sendMessage(action)}
                disabled={isLoading}
                className="px-3 py-1.5 text-xs font-medium rounded-full bg-white/5 border border-white/10 text-slate-300 hover:bg-white/10 hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {action}
              </button>
            ))}
          </div>
          <p className="text-center text-xs text-slate-500 mt-3">
            Our chatbot uses AI to respond and may occasionally make mistakes. Please verify important information.
          </p>
        </footer>
      </div>
    </div>
  );
}
