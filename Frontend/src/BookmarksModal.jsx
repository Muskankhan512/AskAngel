import React, { useState, useEffect, useContext } from 'react';
import './BookmarksModal.css';
import { MyContext } from './MyContext.jsx';

function BookmarksModal({ isOpen, onClose }) {
    const [bookmarks, setBookmarks] = useState([]);
    const [loading, setLoading] = useState(true);
    const { token, setCurrThreadId, setNewChat, handleLogout } = useContext(MyContext);

    useEffect(() => {
        if (isOpen) {
            fetchBookmarks();
        }
    }, [isOpen]);

    const fetchBookmarks = async () => {
        setLoading(true);
        try {
            const res = await fetch(`${import.meta.env.VITE_API_URL || "http://localhost:8080"}` + "/api/bookmarks", {
                headers: { "Authorization": `Bearer ${token}` }
            });
            if (res.status === 401) {
                handleLogout();
                return;
            }
            const data = await res.json();
            setBookmarks(data);
        } catch (err) {
            console.error("Failed to fetch bookmarks:", err);
        } finally {
            setLoading(false);
        }
    };

    const handleGoToChat = (threadId) => {
        setCurrThreadId(threadId);
        setNewChat(false);
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="modalOverlay" onClick={onClose}>
            <div className="bookmarksModal" onClick={e => e.stopPropagation()}>
                <div className="bookmarksHeader">
                    <h2><i className="fa-solid fa-bookmark" style={{marginRight: '8px', color: 'var(--accent-color)'}}></i> Bookmarks</h2>
                    <button className="closeBtn" onClick={onClose}>
                        <i className="fa-solid fa-xmark"></i>
                    </button>
                </div>
                
                <div className="bookmarksList">
                    {loading ? (
                        <p style={{textAlign: 'center', color: 'var(--text-secondary)'}}>Loading bookmarks...</p>
                    ) : bookmarks.length === 0 ? (
                        <div className="noBookmarks">
                            <i className="fa-regular fa-bookmark" style={{fontSize: '2rem', marginBottom: '10px'}}></i>
                            <p>No bookmarks yet. Star some messages to see them here!</p>
                        </div>
                    ) : (
                        bookmarks.map((bm, index) => (
                            <div key={index} className="bookmarkCard">
                                <div className="bookmarkMeta">
                                    <span className="bookmarkRole">
                                        {bm.role === 'user' ? <i className="fa-solid fa-user"></i> : <i className="fa-solid fa-robot"></i>} {bm.role}
                                    </span>
                                    <span>{new Date(bm.timestamp).toLocaleDateString()}</span>
                                </div>
                                <div className="bookmarkContent">
                                    {bm.content}
                                </div>
                                <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                                    <span style={{fontSize: '0.8rem', color: 'var(--text-secondary)'}}>From: {bm.threadTitle}</span>
                                    <button className="goToChatBtn" onClick={() => handleGoToChat(bm.threadId)}>
                                        Go to chat <i className="fa-solid fa-arrow-right" style={{marginLeft: '4px'}}></i>
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}

export default BookmarksModal;
