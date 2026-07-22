import "./ChatWindow.css";
import Chat from "./Chat.jsx";
import { MyContext } from "./MyContext.jsx";
import { useContext, useState, useRef, useEffect } from "react";
import { translations } from "./translations.js";
import html2pdf from "html2pdf.js";
import ShareModal from "./ShareModal.jsx";
import ProfileModal from "./ProfileModal.jsx";
import BookmarksModal from "./BookmarksModal.jsx";
import StatsModal from "./StatsModal.jsx";
import Spinner from "./Spinner.jsx";

function ChatWindow({ setShowShortcuts }) {
    const {
        prompt, setPrompt, currThreadId, prevChats, setPrevChats, newChat, setNewChat,
        theme, setTheme, loading, setLoading, token, user, handleLogout,
        streamingText, setStreamingText, isStreaming, setIsStreaming,
        language, setLanguage,
        persona, setPersona,
        model, setModel,
        messageCountToday, setMessageCountToday,
        soundEnabled, setSoundEnabled,
        isSidebarOpenMobile, setIsSidebarOpenMobile,
        isBookmarksOpen, setIsBookmarksOpen,
        isStatsOpen, setIsStatsOpen,
        isProfileModalOpen, setIsProfileModalOpen,
        isShareModalOpen, setIsShareModalOpen,
        currentShareId, setCurrentShareId
    } = useContext(MyContext);

    const t = translations[language];

    const navRef = useRef(null);

    const [isOpen, setIsOpen] = useState(false);
    const [isLangOpen, setIsLangOpen] = useState(false);
    const [isPersonaOpen, setIsPersonaOpen] = useState(false);
    const [isExportOpen, setIsExportOpen] = useState(false);
    const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
    const [isModelOpen, setIsModelOpen] = useState(false);

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (navRef.current && !navRef.current.contains(e.target)) {
                setIsOpen(false);
                setIsLangOpen(false);
                setIsPersonaOpen(false);
                setIsMoreMenuOpen(false);
                setIsModelOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const playDing = () => {
        if (!soundEnabled) return;
        try {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            if (!AudioContext) return;
            
            const audioCtx = new AudioContext();
            const oscillator = audioCtx.createOscillator();
            const gainNode = audioCtx.createGain();
            
            oscillator.type = 'sine';
            oscillator.frequency.setValueAtTime(800, audioCtx.currentTime); // High pitch ding
            oscillator.frequency.exponentialRampToValueAtTime(300, audioCtx.currentTime + 0.1);
            
            gainNode.gain.setValueAtTime(0.5, audioCtx.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.5);
            
            oscillator.connect(gainNode);
            gainNode.connect(audioCtx.destination);
            
            oscillator.start();
            oscillator.stop(audioCtx.currentTime + 0.5);
        } catch (e) {
            console.error("Audio playback failed", e);
        }
    };
    
    // Search UI states
    const [isSearching, setIsSearching] = useState(false);
    const [streamingSearchMetadata, setStreamingSearchMetadata] = useState(null);

    const personaOptions = [
        "Default Assistant",
        "Coding Assistant",
        "Friendly Tutor",
        "Motivational Coach",
        "Doctor Advisor"
    ];

    const langOptions = [
        { code: 'en', label: 'English' },
        { code: 'hi', label: 'हिंदी' },
        { code: 'pa', label: 'ਪੰਜਾਬੀ' },
        { code: 'ur', label: 'اردو' },
        { code: 'mr', label: 'मराठी' },
        { code: 'bn', label: 'বাংলা' }
    ];

    // ── Voice input state ──
    const [isListening, setIsListening] = useState(false);
    const [speechSupported] = useState(() =>
        !!(window.SpeechRecognition || window.webkitSpeechRecognition)
    );
    const recognitionRef = useRef(null);

    // ── File attachment state ──
    const [selectedFile, setSelectedFile] = useState(null);  // { file, previewUrl, type }
    const fileInputRef = useRef(null);

    const authHeaders = {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
    };

    // ── Voice input ──
    const startListening = () => {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) return;

        if (isListening) {
            recognitionRef.current?.stop();
            return;
        }

        const recognition = new SpeechRecognition();
        recognitionRef.current = recognition;
        recognition.lang = "en-US";
        recognition.interimResults = true;
        recognition.continuous = false;

        recognition.onstart = () => setIsListening(true);
        recognition.onresult = (e) => {
            let interim = "", final = "";
            for (let i = e.resultIndex; i < e.results.length; i++) {
                const t = e.results[i][0].transcript;
                e.results[i].isFinal ? (final += t) : (interim += t);
            }
            setPrompt(final || interim);
        };
        recognition.onerror = () => setIsListening(false);
        recognition.onend = () => setIsListening(false);
        recognition.start();
    };

    // ── File attachment ──
    const handleFileSelect = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const isImage = file.type.startsWith("image/");
        const isPDF = file.type === "application/pdf";

        if (!isImage && !isPDF) return;

        const previewUrl = isImage ? URL.createObjectURL(file) : null;
        setSelectedFile({ file, previewUrl, type: isImage ? "image" : "pdf" });

        // reset file input so same file can be re-selected
        e.target.value = "";
    };

    const removeFile = () => {
        if (selectedFile?.previewUrl) URL.revokeObjectURL(selectedFile.previewUrl);
        setSelectedFile(null);
    };

    // ── Stream helper: read SSE response body ──
    const readStream = async (response, userEntry) => {
        if (!response.body) throw new Error("No response body");

        setLoading(false);
        setIsStreaming(true);

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let accumulated = "";

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split("\n").filter(l => l.startsWith("data: "));

            for (const line of lines) {
                const raw = line.slice(6).trim();
                if (raw === "[DONE]") {
                    const assistantEntry = {
                        role: "assistant",
                        content: accumulated,
                        timestamp: new Date().toISOString()
                    };
                    
                    // Attach search metadata if it exists
                    setStreamingSearchMetadata(currentMeta => {
                        if (currentMeta) {
                            assistantEntry.searchQuery = currentMeta.query;
                            assistantEntry.searchSources = currentMeta.sources;
                        }
                        return currentMeta;
                    });

                    setPrevChats(prev => [...prev, assistantEntry]);
                    setStreamingText("");
                    setIsStreaming(false);
                    setIsSearching(false);
                    setStreamingSearchMetadata(null);
                    playDing();
                    return;
                }
                let parsed;
                try {
                    parsed = JSON.parse(raw);
                } catch (parseErr) {
                    if (raw && raw !== "[DONE]") {
                        console.warn("Could not parse SSE line:", raw);
                    }
                    continue;
                }

                if (parsed.type === "quota") {
                    setMessageCountToday(parsed.messageCountToday);
                } else if (parsed.token) {
                    accumulated += parsed.token;
                    setStreamingText(accumulated);
                }
                if (parsed.error) {
                    console.error("❌ Stream error from server:", parsed.error);
                    throw new Error(parsed.error);
                }
                if (parsed.type === "search_started") {
                    setIsSearching(true);
                    setStreamingSearchMetadata({ query: parsed.query, sources: [] });
                }
                if (parsed.type === "search_completed") {
                    setIsSearching(false);
                    setStreamingSearchMetadata(prev => ({ ...prev, sources: parsed.sources }));
                }
            }
        }

        if (accumulated) {
            setPrevChats(prev => {
                const assistantEntry = {
                    role: "assistant",
                    content: accumulated,
                    timestamp: new Date().toISOString()
                };
                setStreamingSearchMetadata(currentMeta => {
                    if (currentMeta) {
                        assistantEntry.searchQuery = currentMeta.query;
                        assistantEntry.searchSources = currentMeta.sources;
                    }
                    return currentMeta;
                });
                return [...prev, assistantEntry];
            });
        }
        setStreamingText("");
        setIsStreaming(false);
        setIsSearching(false);
        setStreamingSearchMetadata(null);
        playDing();
    };

    // ── Send message (with or without file) ──
    const getReply = async (overrideMessage = null) => {
        const textToUse = overrideMessage || prompt;
        if ((!textToUse.trim() && !selectedFile) || loading || isStreaming || messageCountToday >= 50) return;

        const userMessage = textToUse;
        const fileToSend = selectedFile;

        const wasNewChat = newChat;

        setPrompt("");
        setSelectedFile(null);
        setLoading(true);
        setNewChat(false);
        setStreamingText("");
        setIsStreaming(false);

        const userEntry = {
            role: "user",
            content: userMessage,
            timestamp: new Date().toISOString(),
            ...(fileToSend?.type === "image" && { imageUrl: fileToSend.previewUrl }),
            ...(fileToSend?.type === "pdf" && { pdfName: fileToSend.file.name })
        };
        setPrevChats(prev => [...prev, userEntry]);

        try {
            let response;

            if (fileToSend) {
                const formData = new FormData();
                formData.append("file", fileToSend.file);
                formData.append("message", userMessage);
                formData.append("threadId", currThreadId);
                formData.append("language", language);

                response = await fetch(`${import.meta.env.VITE_API_URL || "http://localhost:8080"}` + "/api/upload", {
                    method: "POST",
                    headers: { "Authorization": `Bearer ${token}` },
                    body: formData
                });
            } else {
                response = await fetch(`${import.meta.env.VITE_API_URL || "http://localhost:8080"}` + "/api/chat", {
                    method: "POST",
                    headers: authHeaders,
                    body: JSON.stringify({ message: userMessage, threadId: currThreadId, language, persona, model })
                });
            }

            if (response.status === 401) { handleLogout(); return; }
            if (response.status === 429) {
                const data = await response.json();
                setPrevChats(prev => [...prev, {
                    role: "assistant",
                    content: `⚠️ ${data.error}`,
                    timestamp: new Date().toISOString()
                }]);
                setLoading(false);
                setIsStreaming(false);
                return;
            }

            await readStream(response, userEntry);

            if (wasNewChat) {
                setTimeout(() => {
                    window.dispatchEvent(new Event('refreshThreads'));
                }, 2000);
            }

        } catch (err) {
            console.error("Chat error:", err);
            setPrevChats(prev => [...prev, {
                role: "assistant",
                content: "⚠️ Sorry, something went wrong while processing your request. Please try again.",
                timestamp: new Date().toISOString()
            }]);
            setLoading(false);
            setIsStreaming(false);
            setIsSearching(false);
            setStreamingSearchMetadata(null);
        }
    };

    // ── Edit message ──
    const handleEditSubmit = async (messageIndex, newText) => {
        if (!newText.trim() || loading || isStreaming || messageCountToday >= 50) return;

        setLoading(true);
        setStreamingText("");
        setIsStreaming(false);

        const userEntry = { role: "user", content: newText, timestamp: new Date().toISOString() };
        setPrevChats(prev => [...prev.slice(0, messageIndex), userEntry]);

        try {
            const response = await fetch(`${import.meta.env.VITE_API_URL || "http://localhost:8080"}` + "/api/chat/edit", {
                method: "PUT",
                headers: authHeaders,
                body: JSON.stringify({ message: newText, threadId: currThreadId, messageIndex, language, persona, model })
            });

            if (response.status === 401) { handleLogout(); return; }
            if (response.status === 429) {
                const data = await response.json();
                setPrevChats(prev => [...prev, {
                    role: "assistant",
                    content: `⚠️ ${data.error}`,
                    timestamp: new Date().toISOString()
                }]);
                setLoading(false);
                setIsStreaming(false);
                return;
            }

            await readStream(response, userEntry);
        } catch (err) {
            console.error("Edit chat error:", err);
            setPrevChats(prev => [...prev, {
                role: "assistant",
                content: "⚠️ Sorry, something went wrong while processing your request. Please try again.",
                timestamp: new Date().toISOString()
            }]);
            setLoading(false);
            setIsStreaming(false);
            setIsSearching(false);
            setStreamingSearchMetadata(null);
        }
    };

    // ── Regenerate message ──
    const handleRegenerate = async (aiMessageIndex) => {
        if (loading || isStreaming || aiMessageIndex <= 0 || messageCountToday >= 50) return;

        setLoading(true);
        setStreamingText("");
        setIsStreaming(false);

        const precedingUserMessage = prevChats[aiMessageIndex - 1];
        setPrevChats(prev => prev.slice(0, aiMessageIndex));

        try {
            const response = await fetch(`${import.meta.env.VITE_API_URL || "http://localhost:8080"}` + "/api/chat/regenerate", {
                method: "POST",
                headers: authHeaders,
                body: JSON.stringify({ threadId: currThreadId, aiMessageIndex, language, persona, model })
            });

            if (response.status === 401) { handleLogout(); return; }
            if (response.status === 429) {
                const data = await response.json();
                setPrevChats(prev => [...prev, {
                    role: "assistant",
                    content: `⚠️ ${data.error}`,
                    timestamp: new Date().toISOString()
                }]);
                setLoading(false);
                setIsStreaming(false);
                return;
            }

            await readStream(response, precedingUserMessage);
        } catch (err) {
            console.error("Regenerate chat error:", err);
            setPrevChats(prev => [...prev, {
                role: "assistant",
                content: "⚠️ Sorry, something went wrong while processing your request. Please try again.",
                timestamp: new Date().toISOString()
            }]);
            setLoading(false);
            setIsStreaming(false);
            setIsSearching(false);
            setStreamingSearchMetadata(null);
        }
    };

    // ── Suggestion Click ──
    const handleSuggestionClick = (text) => {
        getReply(text);
    };

    // ── Export Chat ──
    const handleExportText = () => {
        setIsExportOpen(false);
        if (!prevChats || prevChats.length === 0) return;
        
        let textContent = `AskAngel Chat Export - ${new Date().toLocaleString()}\n\n`;
        prevChats.forEach(msg => {
            const roleName = msg.role === "user" ? (user?.name || "You") : "AskAngel";
            const timestamp = msg.timestamp ? new Date(msg.timestamp).toLocaleString() : "";
            textContent += `${roleName} ${timestamp ? `(${timestamp})` : ""}:\n${msg.content}\n\n`;
        });
        
        const blob = new Blob([textContent], { type: "text/plain" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `AskAngel_Chat_${currThreadId}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const handleExportPDF = () => {
        setIsExportOpen(false);
        if (!prevChats || prevChats.length === 0) return;
        
        const element = document.querySelector('.chats'); 
        if (!element) {
            console.error("Could not find chat container to export");
            return;
        }
        
        const opt = {
            margin:       10,
            filename:     `AskAngel_Chat_${currThreadId}.pdf`,
            image:        { type: 'jpeg', quality: 0.98 },
            html2canvas:  { scale: 2, useCORS: true },
            jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
        };
        
        html2pdf().set(opt).from(element).save();
    };

    // ── Share Chat ──
    const handleShare = async () => {
        if (!prevChats || prevChats.length === 0) return;
        try {
            const response = await fetch(`${import.meta.env.VITE_API_URL || "http://localhost:8080"}/api/chat/${currThreadId}/share`, {
                method: "POST",
                headers: authHeaders
            });
            if (response.ok) {
                const data = await response.json();
                setCurrentShareId(data.shareId);
                setIsShareModalOpen(true);
            }
        } catch (err) {
            console.error(err);
        }
    };

    const handleUnshare = async () => {
        try {
            await fetch(`${import.meta.env.VITE_API_URL || "http://localhost:8080"}/api/chat/${currThreadId}/unshare`, {
                method: "POST",
                headers: authHeaders
            });
            setIsShareModalOpen(false);
            setCurrentShareId(null);
        } catch (err) {
            console.error(err);
        }
    };

    return (
        <div className="chatWindow">
            <div className="navbar">
                <div style={{display: 'flex', alignItems: 'center'}}>
                    <div 
                        className="hamburgerBtn" 
                        onClick={() => setIsSidebarOpenMobile(true)}
                        title="Open Menu"
                    >
                        <i className="fa-solid fa-bars"></i>
                    </div>
                    <span className="navbarTitle">AskAngel <i className="fa-solid fa-chevron-down"></i></span>
                </div>
                <div className="navbarControls" ref={navRef}>
                    {user && <span className="navGreeting hide-on-mobile">Hi, {user.name}!</span>}
                    
                    {/* Bookmarks Toggle */}
                    <div
                        className="navItem iconItem hide-on-mobile"
                        onClick={() => setIsBookmarksOpen(true)}
                        title="Bookmarks"
                    >
                        <i className="fa-solid fa-bookmark"></i>
                    </div>
                    
                    {/* Model Selector */}
                    <div
                        className="navItem textItem hide-on-mobile"
                        onClick={() => { setIsModelOpen(!isModelOpen); setIsPersonaOpen(false); setIsLangOpen(false); setIsOpen(false); setIsMoreMenuOpen(false); }}
                        title="Select Model"
                    >
                        <i className="fa-solid fa-brain"></i> {model === "gemini-pro-latest" ? "Gemini Pro" : model === "gemini-flash-latest" ? "Gemini Flash" : "Gemini Flash Lite"}
                        
                        {isModelOpen && (
                            <div className="dropDown" style={{ top: '45px', right: '0', minWidth: '180px' }}>
                                {[
                                    { id: "gemini-pro-latest", name: "Gemini Pro (Best Quality)" },
                                    { id: "gemini-flash-latest", name: "Gemini Flash (Fast)" },
                                    { id: "gemini-flash-lite-latest", name: "Gemini Flash Lite (Fastest)" }
                                ].map((m) => (
                                    <div 
                                        key={m.id}
                                        className="dropDownItem" 
                                        style={{ backgroundColor: model === m.id ? 'var(--bg-hover)' : 'transparent', color: model === m.id ? 'var(--accent-color)' : 'var(--text-primary)' }}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setModel(m.id);
                                            setIsModelOpen(false);
                                        }}
                                    >
                                        <i className="fa-solid fa-microchip menuIcon"></i> {m.name}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Persona Selector */}
                    <div
                        className="navItem textItem hide-on-mobile"
                        onClick={() => { setIsPersonaOpen(!isPersonaOpen); setIsLangOpen(false); setIsOpen(false); setIsMoreMenuOpen(false); }}
                    >
                        {persona} <i className="fa-solid fa-caret-down" style={{fontSize: '0.8rem'}}></i>
                        {isPersonaOpen && (
                            <div className="dropDown" style={{top: '45px', right: '0', minWidth: '150px'}}>
                                {personaOptions.map(p => (
                                    <div 
                                        key={p} 
                                        className="dropDownItem" 
                                        style={{ fontWeight: persona === p ? 'bold' : 'normal' }}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setPersona(p);
                                            setIsPersonaOpen(false);
                                        }}
                                    >
                                        {p}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                    
                    {/* Language Selector */}
                    <div
                        className="navItem textItem hide-on-mobile"
                        onClick={() => { setIsLangOpen(!isLangOpen); setIsPersonaOpen(false); setIsOpen(false); setIsMoreMenuOpen(false); }}
                    >
                        {langOptions.find(l => l.code === language)?.label || 'Language'} <i className="fa-solid fa-caret-down" style={{fontSize: '0.8rem'}}></i>
                        {isLangOpen && (
                            <div className="dropDown" style={{top: '45px', right: '0', minWidth: '100px'}}>
                                {langOptions.map(option => (
                                    <div 
                                        key={option.code} 
                                        className="dropDownItem" 
                                        style={{ fontWeight: language === option.code ? 'bold' : 'normal' }}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setLanguage(option.code);
                                            setIsLangOpen(false);
                                        }}
                                    >
                                        {option.label}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Theme Toggle */}
                    <div
                        className="navItem iconItem hide-on-mobile"
                        onClick={() => {
                            setTheme(theme === 'dark' ? 'light' : 'dark');
                            setIsOpen(false);
                            setIsLangOpen(false);
                            setIsPersonaOpen(false);
                            setIsMoreMenuOpen(false);
                        }}
                        title="Toggle Theme"
                    >
                        {theme === 'dark' ? <i className="fa-solid fa-sun"></i> : <i className="fa-solid fa-moon"></i>}
                    </div>

                    {/* More Options (...) */}
                    <div
                        className="navItem iconItem hide-on-mobile"
                        onClick={() => { setIsMoreMenuOpen(!isMoreMenuOpen); setIsPersonaOpen(false); setIsLangOpen(false); setIsOpen(false); }}
                        title="More options"
                    >
                        <i className="fa-solid fa-ellipsis-vertical"></i>
                        {isMoreMenuOpen && (
                            <div className="dropDown" style={{top: '45px', right: '0', minWidth: '180px'}}>
                                <div className="dropDownItem show-on-mobile" onClick={(e) => { e.stopPropagation(); setIsBookmarksOpen(true); setIsMoreMenuOpen(false); }}>
                                    <i className="fa-solid fa-bookmark menuIcon"></i> Bookmarks
                                </div>
                                <div className="dropDownItem show-on-mobile" onClick={(e) => { e.stopPropagation(); setIsModelOpen(true); setIsMoreMenuOpen(false); }}>
                                    <i className="fa-solid fa-brain menuIcon"></i> Change Model
                                </div>
                                <div className="dropDownItem show-on-mobile" onClick={(e) => { e.stopPropagation(); setIsPersonaOpen(true); setIsMoreMenuOpen(false); }}>
                                    <i className="fa-solid fa-user-astronaut menuIcon"></i> Change Persona
                                </div>
                                <div className="dropDownItem show-on-mobile" onClick={(e) => { e.stopPropagation(); setIsLangOpen(true); setIsMoreMenuOpen(false); }}>
                                    <i className="fa-solid fa-language menuIcon"></i> Change Language
                                </div>
                                <div className="dropDownItem" onClick={(e) => { e.stopPropagation(); setSoundEnabled(!soundEnabled); setIsMoreMenuOpen(false); }}>
                                    <i className={`fa-solid ${soundEnabled ? 'fa-volume-high' : 'fa-volume-xmark'} menuIcon`}></i> 
                                    {soundEnabled ? 'Mute Sounds' : 'Unmute Sounds'}
                                </div>
                                <div className="dropDownItem" onClick={(e) => { e.stopPropagation(); setShowShortcuts(true); setIsMoreMenuOpen(false); }}>
                                    <i className="fa-solid fa-keyboard menuIcon"></i> Keyboard Shortcuts
                                </div>
                                <div className="dropDownItem" onClick={(e) => { e.stopPropagation(); handleExportPDF(); setIsMoreMenuOpen(false); }}>
                                    <i className="fa-solid fa-file-pdf menuIcon"></i> Export as PDF
                                </div>
                                <div className="dropDownItem" onClick={(e) => { e.stopPropagation(); handleExportText(); setIsMoreMenuOpen(false); }}>
                                    <i className="fa-solid fa-file-lines menuIcon"></i> Export as Text
                                </div>
                                <div className="dropDownItem" onClick={() => { setIsMoreMenuOpen(false); handleShare(); }}>
                                    <i className="fa-solid fa-share-nodes menuIcon"></i> {t.shareChat || "Share Chat"}
                                </div>
                                <div className="dropDownItem" onClick={() => { setIsMoreMenuOpen(false); setIsStatsOpen(true); }}>
                                    <i className="fa-solid fa-chart-simple menuIcon"></i> Insights & Stats
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Mobile Only: New Chat Action */}
                    <div
                        className="navItem iconItem show-on-mobile"
                        onClick={() => {
                            setNewChat(true);
                            setPrompt("");
                            setReply(null);
                            setCurrThreadId(uuidv1());
                            setPrevChats([]);
                        }}
                        title="New Chat"
                    >
                        <i className="fa-solid fa-pen-to-square"></i>
                    </div>

                    {/* User Avatar */}
                    <div className="userIconDiv navItem hide-on-mobile" onClick={() => { setIsOpen(!isOpen); setIsLangOpen(false); setIsPersonaOpen(false); setIsMoreMenuOpen(false); }}>
                        <span className="userIcon">
                            {user?.avatar ? <img src={user.avatar} alt="avatar" style={{width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover'}} /> : <i className="fa-solid fa-user"></i>}
                        </span>
                    </div>
                </div>
            </div>

            {isOpen &&
                <div className="dropDown" style={{top: '4.5rem', right: '1.5rem'}}>
                    <div className="dropDownItem" onClick={() => { setIsProfileModalOpen(true); setIsOpen(false); }}>
                        <i className="fa-solid fa-gear menuIcon"></i> Profile Settings
                    </div>
                    <div className="dropDownItem"><i className="fa-solid fa-cloud-arrow-up menuIcon"></i> {t.upgradePlan}</div>
                    <div className="dropDownItem danger" onClick={handleLogout}>
                        <i className="fa-solid fa-arrow-right-from-bracket menuIcon"></i> {t.logout}
                    </div>
                </div>
            }

            {messageCountToday >= 40 && messageCountToday < 50 && (
                <div style={{ backgroundColor: 'var(--accent-color)', color: 'white', padding: '10px', textAlign: 'center', fontWeight: 'bold' }}>
                    ⚠️ You've used {messageCountToday}/50 messages today.
                </div>
            )}
            {messageCountToday >= 50 && (
                <div style={{ backgroundColor: '#ff4444', color: 'white', padding: '10px', textAlign: 'center', fontWeight: 'bold' }}>
                    ⚠️ You've reached your daily limit of 50 messages. Please try again tomorrow.
                </div>
            )}

            <Chat 
                onEditSubmit={handleEditSubmit} 
                onSuggestionClick={handleSuggestionClick} 
                onRegenerate={handleRegenerate}
                isSearching={isSearching}
                streamingSearchMetadata={streamingSearchMetadata}
            />

            <div className="chatInput">
                {/* File preview strip */}
                {selectedFile && (
                    <div className="filePreview">
                        {selectedFile.type === "image"
                            ? <img src={selectedFile.previewUrl} alt="preview" />
                            : <div className="filePreviewIcon"><i className="fa-solid fa-file-pdf"></i></div>
                        }
                        <span className="filePreviewName">{selectedFile.file.name}</span>
                        <button className="filePreviewRemove" onClick={removeFile} title="Remove file">
                            <i className="fa-solid fa-xmark"></i>
                        </button>
                    </div>
                )}

                <div className="inputBox">
                    {/* Hidden file input */}
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept=".jpg,.jpeg,.png,.pdf"
                        style={{ display: "none" }}
                        onChange={handleFileSelect}
                    />

                    <input
                        placeholder={selectedFile ? t.askAboutFile : t.askAnything}
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' ? getReply() : ''}
                        disabled={loading || isStreaming}
                    />

                    {/* Attachment button */}
                    <button
                        className={`attachBtn ${selectedFile ? 'attachBtn--active' : ''}`}
                        onClick={() => fileInputRef.current?.click()}
                        title="Attach image or PDF"
                        disabled={loading || isStreaming}
                    >
                        <i className="fa-solid fa-paperclip"></i>
                    </button>

                    {/* Mic button */}
                    {speechSupported && (
                        <button
                            className={`micBtn ${isListening ? 'micBtn--listening' : ''}`}
                            onClick={startListening}
                            title={isListening ? 'Stop listening' : 'Speak your message'}
                        >
                            <i className="fa-solid fa-microphone"></i>
                        </button>
                    )}

                    {/* Send button */}
                    <button id="submit" onClick={() => getReply(null)} disabled={loading || isStreaming || messageCountToday >= 50}>
                        {loading || isStreaming ? (
                            <Spinner size="small" />
                        ) : (
                            <i className="fa-solid fa-paper-plane"></i>
                        )}
                    </button>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0 20px', marginTop: '5px' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                        {prompt.length} {t.characters} | ~{Math.round(prompt.length / 4)} {t.tokensApprox}
                    </span>
                    <p className="info" style={{ margin: 0 }}>
                        {t.freeResearchPreview}
                    </p>
                </div>
            </div>

            {/* Modals */}
            <BookmarksModal isOpen={isBookmarksOpen} onClose={() => setIsBookmarksOpen(false)} />
            <StatsModal isOpen={isStatsOpen} onClose={() => setIsStatsOpen(false)} />
            <ShareModal 
                isOpen={isShareModalOpen} 
                onClose={() => setIsShareModalOpen(false)} 
                shareId={currentShareId} 
                onRevoke={handleUnshare}
            />
            {isProfileModalOpen && (
                <ProfileModal onClose={() => setIsProfileModalOpen(false)} />
            )}
        </div>
    );
}

export default ChatWindow;