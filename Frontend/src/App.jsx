import './App.css';
import Sidebar from "./Sidebar.jsx";
import ChatWindow from "./ChatWindow.jsx";
import Login from "./Login.jsx";
import Signup from "./Signup.jsx";
import { MyContext } from "./MyContext.jsx";
import ShortcutsModal from "./ShortcutsModal.jsx";
import SharedChatView from "./SharedChatView.jsx";
import { useState, useEffect } from 'react';
import {v1 as uuidv1} from "uuid";

function App() {
  // ── Auth state ──
  const [token, setToken] = useState(localStorage.getItem("token") || null);
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem("user")) || null; }
    catch { return null; }
  });
  const [authView, setAuthView] = useState("login"); // "login" | "signup"

  // ── Chat state ──
  const [prompt, setPrompt] = useState("");
  const [reply, setReply] = useState(null);
  const [currThreadId, setCurrThreadId] = useState(uuidv1());
  const [prevChats, setPrevChats] = useState([]);
  const [newChat, setNewChat] = useState(true);
  const [allThreads, setAllThreads] = useState([]);
  const [theme, setTheme] = useState(localStorage.getItem("theme") || "dark");
  const [loading, setLoading] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);

  const [language, setLanguage] = useState(localStorage.getItem("language") || "en");
  const [persona, setPersona] = useState("Default Assistant");
  const [model, setModel] = useState(localStorage.getItem("model") || "llama-3.3-70b-versatile");
  const [messageCountToday, setMessageCountToday] = useState(0);

  const [showShortcuts, setShowShortcuts] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(localStorage.getItem("soundEnabled") !== "false");
  const [isSidebarOpenMobile, setIsSidebarOpenMobile] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (prompt && prompt.trim() !== "") {
            const confirm = window.confirm("You have unsent text. Start a new chat anyway?");
            if (!confirm) return;
        }
        setNewChat(true);
        setPrompt("");
        setReply(null);
        setCurrThreadId(uuidv1());
        setPrevChats([]);
      }
      if ((e.ctrlKey || e.metaKey) && e.key === '/') {
        e.preventDefault();
        setShowShortcuts(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [prompt]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem("theme", theme);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem("language", language);
  }, [language]);

  useEffect(() => {
    localStorage.setItem("soundEnabled", soundEnabled);
  }, [soundEnabled]);

  useEffect(() => {
    localStorage.setItem("model", model);
  }, [model]);

  // Load draft when thread changes
  useEffect(() => {
    if (currThreadId) {
      const savedDraft = localStorage.getItem(`draft_${currThreadId}`);
      if (savedDraft) {
        setPrompt(savedDraft);
      } else {
        setPrompt("");
      }
    }
  }, [currThreadId]);

  // Save draft when prompt changes, but only if the thread hasn't just changed
  useEffect(() => {
    if (currThreadId) {
      if (prompt.trim() !== "") {
        localStorage.setItem(`draft_${currThreadId}`, prompt);
      } else {
        localStorage.removeItem(`draft_${currThreadId}`);
      }
    }
  }, [prompt]); // Only run when prompt changes, not when currThreadId changes

  const handleLogin = (userData) => {
    setToken(localStorage.getItem("token"));
    setUser(userData);
    if (userData && userData.messageCountToday !== undefined) {
      setMessageCountToday(userData.messageCountToday);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setToken(null);
    setUser(null);
    setAllThreads([]);
    setPrevChats([]);
    setNewChat(true);
    setCurrThreadId(uuidv1());
  };

  // ── Public route interception ──
  const pathname = window.location.pathname;
  if (pathname.startsWith('/shared/')) {
    const shareId = pathname.split('/shared/')[1];
    if (shareId) {
      return <SharedChatView shareId={shareId} />;
    }
  }

  // ── Route protection: show auth if no token ──
  if (!token) {
    return (
      <div style={{backgroundColor: 'var(--bg-primary)', minHeight: '100vh'}}>
        <MyContext.Provider value={{ language, setLanguage }}>
          {authView === "login"
            ? <Login onSwitch={() => setAuthView("signup")} onLogin={handleLogin} />
            : <Signup onSwitch={() => setAuthView("login")} onLogin={handleLogin} />
          }
        </MyContext.Provider>
      </div>
    );
  }

  const providerValues = {
    prompt, setPrompt,
    reply, setReply,
    currThreadId, setCurrThreadId,
    newChat, setNewChat,
    prevChats, setPrevChats,
    allThreads, setAllThreads,
    theme, setTheme,
    loading, setLoading,
    streamingText, setStreamingText,
    isStreaming, setIsStreaming,
    token, setToken,
    user, setUser,
    handleLogout,
    language, setLanguage,
    persona, setPersona,
    model, setModel,
    messageCountToday, setMessageCountToday,
    soundEnabled, setSoundEnabled,
    isSidebarOpenMobile, setIsSidebarOpenMobile
  };

  return (
    <div className='app'>
      <MyContext.Provider value={providerValues}>
          <Sidebar></Sidebar>
          <ChatWindow setShowShortcuts={setShowShortcuts}></ChatWindow>
          <ShortcutsModal isOpen={showShortcuts} onClose={() => setShowShortcuts(false)} />
        </MyContext.Provider>
    </div>
  )
}

export default App;
