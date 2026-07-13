import "./Chat.css";
import React, { useContext, useState, useEffect, useRef } from "react";
import { MyContext } from "./MyContext";
import ReactMarkdown from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import "highlight.js/styles/github-dark.css";
import { translations } from "./translations.js";

// ── helper: format a Date or ISO string to "2:34 PM" ──
function formatTime(ts) {
    const d = ts ? new Date(ts) : new Date();
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

// ── Copy button ──
function CopyButton({ text }) {
    const [copied, setCopied] = useState(false);

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(text);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            console.error("Failed to copy:", err);
        }
    };

    return (
        <button className="copyBtn" onClick={handleCopy} title="Copy response">
            {copied
                ? <i className="fa-solid fa-check"></i>
                : <i className="fa-regular fa-copy"></i>
            }
        </button>
    );
}

// ── Animated typing indicator (three bouncing dots) — shown while waiting ──
function TypingIndicator({ persona }) {
    const name = persona === 'Default Assistant' ? 'AskAngel' : persona;
    return (
        <div className="gptDiv">
            <div className="gptResponse" style={{ display: 'flex', alignItems: 'center', gap: '10px', background: 'none', border: 'none' }}>
                <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>{name} is typing</span>
                <div className="typingIndicator">
                    <span></span><span></span><span></span>
                </div>
            </div>
        </div>
    );
}

function Chat({ onEditSubmit, onSuggestionClick, onRegenerate, isSearching, streamingSearchMetadata }) {
    const { newChat, prevChats, setPrevChats, loading, streamingText, isStreaming, language, currThreadId, token, handleLogout, persona } = useContext(MyContext);
    const t = translations[language];
    const [editingIndex, setEditingIndex] = useState(null);
    const [editValue, setEditValue] = useState("");
    const bottomRef = useRef(null);

    // Auto-scroll whenever content changes
    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [prevChats, streamingText, loading]);

    const handleReaction = async (idx, reactionType) => {
        const currentReaction = prevChats[idx].reaction;
        const newReaction = currentReaction === reactionType ? null : reactionType;
        
        setPrevChats(prev => prev.map((msg, i) => i === idx ? { ...msg, reaction: newReaction } : msg));

        try {
            const response = await fetch(`http://localhost:8080/api/chat/${currThreadId}/message/${idx}/reaction`, {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },
                body: JSON.stringify({ reaction: newReaction })
            });

            if (response.status === 401) { handleLogout(); return; }
        } catch (err) {
            console.error("Reaction error:", err);
        }
    };

    const handleBookmark = async (idx) => {
        const isCurrentlyBookmarked = prevChats[idx].isBookmarked || false;
        const newStatus = !isCurrentlyBookmarked;
        
        setPrevChats(prev => prev.map((msg, i) => i === idx ? { ...msg, isBookmarked: newStatus } : msg));

        try {
            const response = await fetch(`http://localhost:8080/api/chat/${currThreadId}/message/${idx}/bookmark`, {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },
                body: JSON.stringify({ isBookmarked: newStatus })
            });
            if (response.status === 401) { handleLogout(); return; }
        } catch (err) {
            console.error("Bookmark error:", err);
        }
    };

    const suggestions = [
        { icon: "fa-atom", text: "Explain quantum computing simply" },
        { icon: "fa-water", text: "Write a short poem about the ocean" },
        { icon: "fa-dumbbell", text: "Help me plan a weekly workout routine" },
        { icon: "fa-bowl-food", text: "What are some healthy breakfast ideas" }
    ];

    return (
        <div className="chatContentWrapper" style={{ flex: 1, width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', overflow: 'hidden' }}>
            {(newChat && !prevChats.length) ? (
                <div className="newChatScreen">
                    <div className="welcomeIcon">
                        <i className="fa-solid fa-robot"></i>
                    </div>
                    <h1>AskAngel</h1>
                    <p className="welcomeTagline">Ask me anything, I'm here to help.</p>
                    <div className="suggestionsGrid">
                        {suggestions.map((s, i) => (
                            <div key={i} className="suggestionCard" onClick={() => onSuggestionClick(s.text)}>
                                <i className={`fa-solid ${s.icon}`}></i>
                                <p>{s.text}</p>
                            </div>
                        ))}
                    </div>
                </div>
            ) : (
            <div className="chats">

                {/* All committed messages */}
                {prevChats.map((chat, idx) => (
                    <div className={chat.role === "user" ? "userDiv" : "gptDiv"} key={idx}>
                        {chat.role === "user" ? (
                            <>
                                {chat.imageUrl && (
                                    <img src={chat.imageUrl} alt="uploaded" className="chatImage" />
                                )}
                                {chat.pdfName && (
                                    <div className="chatPdfBadge">
                                        <i className="fa-solid fa-file-pdf"></i> {chat.pdfName}
                                    </div>
                                )}
                                
                                {editingIndex === idx ? (
                                    <div className="editMessageContainer">
                                        <textarea 
                                            className="editMessageInput"
                                            value={editValue} 
                                            onChange={(e) => setEditValue(e.target.value)}
                                            rows={3}
                                        />
                                        <div className="editMessageActions">
                                            <button className="btn-cancel" onClick={() => setEditingIndex(null)}>{t.cancel}</button>
                                            <button className="btn-save" onClick={() => {
                                                onEditSubmit(idx, editValue);
                                                setEditingIndex(null);
                                            }}>{t.saveResend}</button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="userMessageWrapper">
                                        {chat.content && <p className="userMessage">{chat.content}</p>}
                                        <button 
                                            className="editMsgBtn"
                                            onClick={() => {
                                                setEditingIndex(idx);
                                                setEditValue(chat.content);
                                            }}
                                            title="Edit Message"
                                        >
                                            <i className="fa-solid fa-pencil"></i>
                                        </button>
                                        <button 
                                            className={`reactionBtn ${chat.isBookmarked ? 'activeLike' : ''}`}
                                            onClick={() => handleBookmark(idx)}
                                            title={chat.isBookmarked ? "Remove Bookmark" : "Bookmark"}
                                        >
                                            <i className={chat.isBookmarked ? "fa-solid fa-bookmark" : "fa-regular fa-bookmark"}></i>
                                        </button>
                                    </div>
                                )}
                                <span className="timestamp userTimestamp">{formatTime(chat.timestamp)}</span>
                            </>
                        ) : (
                            <div className="gptResponse">
                                {chat.searchQuery && (
                                    <div className="searchBadge">
                                        <i className="fa-solid fa-magnifying-glass"></i> Searched the web for "{chat.searchQuery}"
                                    </div>
                                )}
                                <ReactMarkdown rehypePlugins={[rehypeHighlight]}>{chat.content}</ReactMarkdown>
                                
                                {chat.searchSources && chat.searchSources.length > 0 && (
                                    <div className="searchSources">
                                        <span className="sourcesTitle">Sources:</span>
                                        <div className="sourcesList">
                                            {chat.searchSources.map((source, idx) => (
                                                <a key={idx} href={source.url} target="_blank" rel="noopener noreferrer" className="sourceLink">
                                                    [{idx + 1}] {new URL(source.url).hostname.replace('www.', '')}
                                                </a>
                                            ))}
                                        </div>
                                    </div>
                                )}
                                <div className="gptMeta">
                                    <span className="timestamp">{formatTime(chat.timestamp)}</span>
                                    <CopyButton text={chat.content} />
                                    <button 
                                        className={`reactionBtn ${chat.reaction === 'like' ? 'activeLike' : ''}`}
                                        onClick={() => handleReaction(idx, 'like')}
                                        title="Like"
                                    >
                                        <i className="fa-solid fa-thumbs-up"></i>
                                    </button>
                                    <button 
                                        className={`reactionBtn ${chat.reaction === 'dislike' ? 'activeDislike' : ''}`}
                                        onClick={() => handleReaction(idx, 'dislike')}
                                        title="Dislike"
                                    >
                                        <i className="fa-solid fa-thumbs-down"></i>
                                    </button>
                                    <button 
                                        className="regenerateBtn" 
                                        onClick={() => onRegenerate(idx)} 
                                        title="Regenerate response"
                                    >
                                        <i className="fa-solid fa-rotate-right"></i>
                                    </button>
                                    <button 
                                        className={`reactionBtn ${chat.isBookmarked ? 'activeLike' : ''}`}
                                        onClick={() => handleBookmark(idx)}
                                        title={chat.isBookmarked ? "Remove Bookmark" : "Bookmark"}
                                    >
                                        <i className={chat.isBookmarked ? "fa-solid fa-bookmark" : "fa-regular fa-bookmark"}></i>
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                ))}

                {/* Waiting for first token: show bouncing dots */}
                {loading && <TypingIndicator persona={persona} />}

                {/* Streaming: show real-time text with blinking cursor */}
                {isStreaming && (
                    <div className="gptDiv">
                        <div className="gptResponse">
                            {isSearching && (
                                <div className="searchBadge pulsing">
                                    <i className="fa-solid fa-magnifying-glass fa-beat-fade"></i> Searching the web for "{streamingSearchMetadata?.query}"...
                                </div>
                            )}
                            {streamingSearchMetadata && !isSearching && (
                                <div className="searchBadge">
                                    <i className="fa-solid fa-magnifying-glass"></i> Searched the web for "{streamingSearchMetadata.query}"
                                </div>
                            )}
                            {streamingText ? (
                                <>
                                    <ReactMarkdown rehypePlugins={[rehypeHighlight]}>
                                        {streamingText}
                                    </ReactMarkdown>
                                    <span className="streamCursor"></span>
                                </>
                            ) : (
                                !isSearching && <span className="typing-indicator">{persona === 'Default Assistant' ? 'AskAngel' : persona} is typing...</span>
                            )}
                            {streamingSearchMetadata?.sources && streamingSearchMetadata.sources.length > 0 && (
                                <div className="searchSources">
                                    <span className="sourcesTitle">Sources:</span>
                                    <div className="sourcesList">
                                        {streamingSearchMetadata.sources.map((source, idx) => (
                                            <a key={idx} href={source.url} target="_blank" rel="noopener noreferrer" className="sourceLink">
                                                [{idx + 1}] {new URL(source.url).hostname.replace('www.', '')}
                                            </a>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* invisible anchor for auto-scroll */}
                <div ref={bottomRef}></div>
            </div>
            )}
        </div>
    );
}

export default Chat;