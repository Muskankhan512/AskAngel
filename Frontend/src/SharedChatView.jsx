import React, { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import rehypeHighlight from 'rehype-highlight';
import 'highlight.js/styles/github-dark.css';
import './ChatWindow.css';
import './Chat.css'; // Reuse existing chat styles

// ── helper: format a Date or ISO string to "2:34 PM" ──
function formatTime(ts) {
    const d = ts ? new Date(ts) : new Date();
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function SharedChatView({ shareId }) {
    const [thread, setThread] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [theme, setTheme] = useState(localStorage.getItem("theme") || "dark");

    useEffect(() => {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem("theme", theme);
    }, [theme]);

    useEffect(() => {
        const fetchSharedChat = async () => {
            try {
                const response = await fetch(`${import.meta.env.VITE_API_URL || "http://localhost:8080"}/api/chat/shared/${shareId}`);
                if (!response.ok) {
                    const data = await response.json();
                    throw new Error(data.error || "Failed to load shared chat");
                }
                const data = await response.json();
                setThread(data);
            } catch (err) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };
        fetchSharedChat();
    }, [shareId]);

    if (loading) {
        return (
            <div className="app" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', width: '100vw' }}>
                <h2 style={{ color: 'var(--text-primary)' }}>Loading shared conversation...</h2>
            </div>
        );
    }

    if (error) {
        return (
            <div className="app" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '100vh', width: '100vw' }}>
                <i className="fa-solid fa-link-slash" style={{ fontSize: '4rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}></i>
                <h2 style={{ color: 'var(--text-primary)' }}>This chat is no longer available</h2>
                <p style={{ color: 'var(--text-secondary)', marginTop: '0.5rem' }}>{error}</p>
                <button 
                    onClick={() => window.location.href = '/'}
                    style={{ marginTop: '2rem', padding: '10px 20px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'transparent', color: 'var(--text-primary)', cursor: 'pointer' }}
                >
                    Go to AskAngel
                </button>
            </div>
        );
    }

    return (
        <div className="app" style={{ display: 'flex', flexDirection: 'column', width: '100vw', height: '100vh', overflow: 'hidden' }}>
            <div className="navbar" style={{ width: '100%', boxSizing: 'border-box', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'center' }}>
                <span style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>AskAngel</span>
                <div style={{ position: 'absolute', right: '20px', display: 'flex', alignItems: 'center', gap: '15px' }}>
                    <div
                        onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                        style={{cursor: 'pointer', fontSize: '1.2rem'}}
                        title="Toggle Theme"
                    >
                        {theme === 'dark' ? <i className="fa-solid fa-sun"></i> : <i className="fa-solid fa-moon"></i>}
                    </div>
                    <button 
                        onClick={() => window.location.href = '/'}
                        style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'transparent', color: 'var(--text-primary)', cursor: 'pointer', fontSize: '0.9rem' }}
                    >
                        Start your own chat
                    </button>
                </div>
            </div>

            <div style={{ 
                width: '100%', 
                backgroundColor: 'rgba(59, 130, 246, 0.1)', 
                color: '#3b82f6', 
                textAlign: 'center', 
                padding: '8px 0', 
                fontSize: '0.9rem',
                borderBottom: '1px solid rgba(59, 130, 246, 0.2)'
            }}>
                <i className="fa-solid fa-circle-info"></i> This is a shared, read-only conversation.
            </div>

            <div className="chatWindow" style={{ width: '100%', maxWidth: '800px', margin: '0 auto', display: 'flex', flexDirection: 'column', flex: 1 }}>
                <div className="chats" style={{ flex: 1, padding: '20px 0', overflowY: 'auto' }}>
                    {thread.title && (
                        <h2 style={{ textAlign: 'center', color: 'var(--text-primary)', marginBottom: '2rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem' }}>
                            {thread.title}
                        </h2>
                    )}
                    
                    {thread.messages.map((chat, idx) => (
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
                                    
                                    <div className="userMessageWrapper">
                                        {chat.content && <p className="userMessage">{chat.content}</p>}
                                    </div>
                                    <span className="timestamp userTimestamp">{formatTime(chat.timestamp)}</span>
                                </>
                            ) : (
                                <div className="gptResponse">
                                    <ReactMarkdown rehypePlugins={[rehypeHighlight]}>{chat.content}</ReactMarkdown>
                                    <div className="gptMeta">
                                        <span className="timestamp">{formatTime(chat.timestamp)}</span>
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

export default SharedChatView;
