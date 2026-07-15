import "./Sidebar.css";
import { useContext, useEffect, useState } from "react";
import { MyContext } from "./MyContext.jsx";
import { useToast } from "./ToastContext";
import {v1 as uuidv1} from "uuid";
import { translations } from "./translations.js";

function Sidebar() {
    const {allThreads, setAllThreads, currThreadId, setNewChat, setPrompt, setReply,
           setCurrThreadId, setPrevChats, token, handleLogout, language, setPersona, prompt,
           isSidebarOpenMobile, setIsSidebarOpenMobile} = useContext(MyContext);
    const [menuOpenId, setMenuOpenId] = useState(null);
    const [renamingId, setRenamingId] = useState(null);
    const [renameValue, setRenameValue] = useState("");
    const [folders, setFolders] = useState([]);
    const [collapsedFolders, setCollapsedFolders] = useState({});
    const [newFolderTitle, setNewFolderTitle] = useState("");
    const [isCreatingFolder, setIsCreatingFolder] = useState(false);
    const [renamingFolderId, setRenamingFolderId] = useState(null);
    const [folderMenuOpenId, setFolderMenuOpenId] = useState(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [searchResults, setSearchResults] = useState([]);
    const [isSearching, setIsSearching] = useState(false);
    const [confirmDeleteId, setConfirmDeleteId] = useState(null);
    const { showToast } = useToast();
    const t = translations[language];

    const authHeaders = {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
    };

    const getAllThreads = async () => {
        try {
            const response = await fetch(`${import.meta.env.VITE_API_URL || "http://localhost:8080"}` + "/api/thread", { headers: authHeaders });
            if (response.status === 401) { handleLogout(); return; }
            const res = await response.json();
            const filteredData = res.map(thread => ({
                threadId: thread.threadId, 
                title: thread.title,
                isPinned: thread.isPinned || false,
                folderId: thread.folderId || null
            }));
            setAllThreads(filteredData);
        } catch(err) {
            console.error(err);
        }
    };

    const getAllFolders = async () => {
        try {
            const response = await fetch(`${import.meta.env.VITE_API_URL || "http://localhost:8080"}` + "/api/folder", { headers: authHeaders });
            if (response.ok) {
                setFolders(await response.json());
            }
        } catch(err) {
            console.log(err);
        }
    };

    useEffect(() => {
        getAllThreads();
        getAllFolders();
    }, [currThreadId]);

    useEffect(() => {
        const handleRefresh = () => {
            getAllThreads();
        };
        window.addEventListener('refreshThreads', handleRefresh);
        return () => window.removeEventListener('refreshThreads', handleRefresh);
    }, []);

    useEffect(() => {
        const handleClickOutside = () => {
            setMenuOpenId(null);
            setFolderMenuOpenId(null);
            setConfirmDeleteId(null);
        };
        document.addEventListener("click", handleClickOutside);
        return () => document.removeEventListener("click", handleClickOutside);
    }, []);

    useEffect(() => {
        if (!searchQuery.trim()) {
            setSearchResults([]);
            setIsSearching(false);
            return;
        }
        
        setIsSearching(true);
        const timeoutId = setTimeout(async () => {
            try {
                const response = await fetch(`${import.meta.env.VITE_API_URL || "http://localhost:8080"}/api/chat/search?q=${encodeURIComponent(searchQuery)}`, { headers: authHeaders });
                if (response.status === 401) { handleLogout(); return; }
                if (response.ok) {
                    const data = await response.json();
                    setSearchResults(data);
                }
            } catch(err) {
                console.log(err);
            } finally {
                setIsSearching(false);
            }
        }, 500);

        return () => clearTimeout(timeoutId);
    }, [searchQuery]);

    const createNewChat = () => {
        if (prompt && prompt.trim() !== "") {
            const confirm = window.confirm("You have unsent text. Start a new chat anyway?");
            if (!confirm) return;
        }
        setNewChat(true);
        setPrompt("");
        setReply(null);
        setCurrThreadId(uuidv1());
        setPrevChats([]);
    };

    const changeThread = async (newThreadId) => {
        setCurrThreadId(newThreadId);
        try {
            const response = await fetch(`${import.meta.env.VITE_API_URL || "http://localhost:8080"}/api/thread/${newThreadId}`, { headers: authHeaders });
            if (response.status === 401) { handleLogout(); return; }
            const res = await response.json();
            setPrevChats(res.messages || []);
            setPersona(res.persona || "Default Assistant");
            setNewChat(false);
            setReply(null);
        } catch(err) {
            console.log(err);
        }
    };

    const deleteThread = async (threadId) => {
        try {
            await fetch(`${import.meta.env.VITE_API_URL || "http://localhost:8080"}/api/thread/${threadId}`, { method: "DELETE", headers: authHeaders });
            setAllThreads(prev => prev.filter(thread => thread.threadId !== threadId));
            if (threadId === currThreadId) createNewChat();
        } catch(err) {
            console.error(err);
            showToast("Failed to delete chat", "error");
        }
        setConfirmDeleteId(null);
    };

    const startRename = (thread) => {
        setRenamingId(thread.threadId);
        setRenameValue(thread.title);
        setMenuOpenId(null);
    };

    const submitRename = async (threadId) => {
        if (!renameValue.trim()) { setRenamingId(null); return; }
        try {
            const response = await fetch(`${import.meta.env.VITE_API_URL || "http://localhost:8080"}/api/thread/${threadId}`, {
                method: "PATCH",
                headers: authHeaders,
                body: JSON.stringify({ title: renameValue.trim() })
            });
            const res = await response.json();
            if (res.success) {
                setAllThreads(prev => prev.map(t =>
                    t.threadId === threadId ? {...t, title: renameValue.trim()} : t
                ));
            }
        } catch(err) {
            console.log(err);
        }
        setRenamingId(null);
    };

    const togglePin = async (threadId) => {
        try {
            const response = await fetch(`${import.meta.env.VITE_API_URL || "http://localhost:8080"}/api/thread/${threadId}/pin`, {
                method: "PATCH",
                headers: authHeaders
            });
            const res = await response.json();
            if (response.ok) {
                setAllThreads(prev => prev.map(t =>
                    t.threadId === threadId ? {...t, isPinned: res.isPinned} : t
                ));
            }
        } catch(err) {
            console.log(err);
        }
    };

    const createFolder = async () => {
        if (!newFolderTitle.trim()) { setIsCreatingFolder(false); return; }
        try {
            const response = await fetch(`${import.meta.env.VITE_API_URL || "http://localhost:8080"}` + "/api/folder", {
                method: "POST",
                headers: authHeaders,
                body: JSON.stringify({ name: newFolderTitle.trim() })
            });
            if (response.ok) {
                const newFolder = await response.json();
                setFolders(prev => [...prev, newFolder]);
            } else {
                showToast("Failed to create folder", "error");
            }
        } catch(err) { 
            console.error(err); 
            showToast("Network error", "error");
        }
        setNewFolderTitle("");
        setIsCreatingFolder(false);
    };

    const renameFolder = async (folderId) => {
        if (!renameValue.trim()) { setRenamingFolderId(null); return; }
        try {
            const response = await fetch(`${import.meta.env.VITE_API_URL || "http://localhost:8080"}/api/folder/${folderId}`, {
                method: "PATCH",
                headers: authHeaders,
                body: JSON.stringify({ name: renameValue.trim() })
            });
            if (response.ok) {
                setFolders(prev => prev.map(f => f._id === folderId ? {...f, name: renameValue.trim()} : f));
            } else {
                showToast("Failed to rename folder", "error");
            }
        } catch(err) { 
            console.error(err); 
            showToast("Network error", "error");
        }
        setRenamingFolderId(null);
    };

    const deleteFolder = async (folderId) => {
        if (!window.confirm("Are you sure you want to delete this folder? (Chats will be moved to Uncategorized)")) return;
        try {
            await fetch(`${import.meta.env.VITE_API_URL || "http://localhost:8080"}/api/folder/${folderId}`, { method: "DELETE", headers: authHeaders });
            setFolders(prev => prev.filter(f => f._id !== folderId));
            setAllThreads(prev => prev.map(t => t.folderId === folderId ? {...t, folderId: null} : t));
        } catch(err) { 
            console.error(err); 
            showToast("Failed to delete folder", "error");
        }
    };

    const moveToFolder = async (threadId, folderId) => {
        try {
            await fetch(`${import.meta.env.VITE_API_URL || "http://localhost:8080"}/api/thread/${threadId}/folder`, {
                method: "PATCH",
                headers: authHeaders,
                body: JSON.stringify({ folderId })
            });
            setAllThreads(prev => prev.map(t => t.threadId === threadId ? {...t, folderId} : t));
        } catch(err) { console.log(err); }
        setMenuOpenId(null);
    };

    const renderThreadList = (threads, title) => {
        if (!threads || threads.length === 0) {
            if (title === null) {
                // This is a folder list
                return (
                    <div className="emptyState" style={{ padding: '12px 16px' }}>
                        <i className="fa-regular fa-folder-open"></i>
                        <p>This folder is empty. Move a chat here to organize it.</p>
                    </div>
                );
            }
            return null;
        }
        return (
            <div className="threadSection">
                <p className="sectionTitle">{title}</p>
                {threads.map((thread, idx) => (
                    <li key={idx}
                        onClick={() => renamingId !== thread.threadId && changeThread(thread.threadId)}
                        className={thread.threadId === currThreadId ? "highlighted" : " "}
                    >
                        {renamingId === thread.threadId ? (
                            <input
                                className="renameInput"
                                value={renameValue}
                                autoFocus
                                onChange={(e) => setRenameValue(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter") submitRename(thread.threadId);
                                    if (e.key === "Escape") setRenamingId(null);
                                }}
                                onBlur={() => submitRename(thread.threadId)}
                                onClick={(e) => e.stopPropagation()}
                            />
                        ) : (
                            <span className="threadTitle">{thread.title}</span>
                        )}

                        <div className="threadActions" onClick={(e) => e.stopPropagation()}>
                            <i 
                                className={`fa-solid fa-thumbtack pinBtn ${thread.isPinned ? "pinned" : ""}`}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    togglePin(thread.threadId);
                                }}
                                title={thread.isPinned ? "Unpin" : "Pin"}
                            ></i>
                            <i
                                className="fa-solid fa-ellipsis threadMenuBtn"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setMenuOpenId(menuOpenId === thread.threadId ? null : thread.threadId);
                                }}
                            ></i>
                                {menuOpenId === thread.threadId && (
                                    <div className="threadMenu">
                                        <div className="threadMenuItem" onClick={(e) => { e.stopPropagation(); startRename(thread); }}>
                                            <i className="fa-solid fa-pencil"></i> {t.rename}
                                        </div>
                                        {/* Folder Submenu */}
                                        <div className="threadMenuItem folder-submenu-parent">
                                            <i className="fa-solid fa-folder"></i> Move to folder
                                            <div className="folder-submenu">
                                                <div className="threadMenuItem" onClick={(e) => { e.stopPropagation(); moveToFolder(thread.threadId, null); }}>
                                                    None (Uncategorized)
                                                </div>
                                                {folders.map(f => (
                                                    <div key={f._id} className="threadMenuItem" onClick={(e) => { e.stopPropagation(); moveToFolder(thread.threadId, f._id); }}>
                                                        {f.name}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                        {confirmDeleteId === thread.threadId ? (
                                            <div className="threadMenuItem danger" onClick={(e) => { e.stopPropagation(); deleteThread(thread.threadId); }}>
                                                <i className="fa-solid fa-check"></i> Confirm Delete
                                            </div>
                                        ) : (
                                            <div className="threadMenuItem danger" onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(thread.threadId); }}>
                                                <i className="fa-solid fa-trash"></i> {t.delete}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </li>
                    ))}
            </div>
        );
    };

    const pinnedThreads = allThreads.filter(t => t.isPinned);
    const unpinnedThreads = allThreads.filter(t => !t.isPinned);
    const uncategorizedThreads = unpinnedThreads.filter(t => !t.folderId);

    return (
        <>
        {isSidebarOpenMobile && (
            <div className="sidebar-backdrop" onClick={() => setIsSidebarOpenMobile(false)}></div>
        )}
        <section className={`sidebar ${isSidebarOpenMobile ? 'mobile-open' : ''}`}>
            <div className="sidebar-header-mobile">
                <div className="mobileTitle">AskAngel</div>
                <button className="sidebar-close-btn" onClick={() => setIsSidebarOpenMobile(false)}>
                    <i className="fa-solid fa-xmark"></i>
                </button>
            </div>
            <button className="newChatBtn" onClick={createNewChat}>
                <img src="src/assets/blacklogo.png" alt="gpt logo" className="logo"></img>
                <span><i className="fa-solid fa-pen-to-square"></i></span>
            </button>

            <div className="searchBox">
                <i className="fa-solid fa-magnifying-glass"></i>
                <input 
                    type="text" 
                    placeholder="Search chats..." 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                />
                {searchQuery && (
                    <i className="fa-solid fa-xmark clearSearch" onClick={() => setSearchQuery("")}></i>
                )}
            </div>

            <ul className="history">
                {searchQuery.trim() ? (
                    isSearching ? (
                        <div style={{padding: '15px', textAlign: 'center', color: 'var(--text-secondary)'}}>Searching...</div>
                    ) : searchResults.length > 0 ? (
                        renderThreadList(searchResults, "Search Results")
                    ) : (
                        <div className="emptyState" style={{ marginTop: '40px' }}>
                            <i className="fa-solid fa-magnifying-glass"></i>
                            <p>No chats found matching "{searchQuery}"</p>
                        </div>
                    )
                ) : (
                    <>
                        {renderThreadList(pinnedThreads, t.pinned || "Pinned")}
                        
                        {/* Folders */}
                        {folders.map(folder => {
                            const folderThreads = unpinnedThreads.filter(t => t.folderId === folder._id);
                            const isCollapsed = collapsedFolders[folder._id];
                            return (
                                <div key={folder._id} className="folderSection">
                                    <div className="folderHeader" onClick={() => setCollapsedFolders(prev => ({...prev, [folder._id]: !isCollapsed}))}>
                                        <span>
                                            <i className={`fa-solid fa-chevron-${isCollapsed ? 'right' : 'down'}`}></i>
                                            <i className="fa-solid fa-folder"></i>
                                            {renamingFolderId === folder._id ? (
                                                <input
                                                    className="renameInput folderRename"
                                                    value={renameValue}
                                                    autoFocus
                                                    onChange={(e) => setRenameValue(e.target.value)}
                                                    onKeyDown={(e) => {
                                                        if (e.key === "Enter") renameFolder(folder._id);
                                                        if (e.key === "Escape") setRenamingFolderId(null);
                                                    }}
                                                    onBlur={() => renameFolder(folder._id)}
                                                    onClick={(e) => e.stopPropagation()}
                                                />
                                            ) : (
                                                <span style={{marginLeft: '5px'}}>{folder.name}</span>
                                            )}
                                        </span>
                                        <div className="folderActions" onClick={e => e.stopPropagation()}>
                                            <i className="fa-solid fa-ellipsis" onClick={() => setFolderMenuOpenId(folderMenuOpenId === folder._id ? null : folder._id)}></i>
                                            {folderMenuOpenId === folder._id && (
                                                <div className="threadMenu" style={{right: 0, left: 'auto', top: '20px'}}>
                                                    <div className="threadMenuItem" onClick={() => { setRenamingFolderId(folder._id); setRenameValue(folder.name); setFolderMenuOpenId(null); }}>
                                                        <i className="fa-solid fa-pencil"></i> Rename
                                                    </div>
                                                    <div className="threadMenuItem danger" onClick={() => deleteFolder(folder._id)}>
                                                        <i className="fa-solid fa-trash"></i> Delete
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    {!isCollapsed && renderThreadList(folderThreads, null)}
                                </div>
                            );
                        })}

                        {/* Uncategorized */}
                        {renderThreadList(uncategorizedThreads, "Uncategorized")}
                        
                        {/* New Folder Button */}
                        <div className="newFolderDiv">
                            {isCreatingFolder ? (
                                <input 
                                    className="renameInput" 
                                    placeholder="Folder Name"
                                    value={newFolderTitle}
                                    autoFocus
                                    onChange={(e) => setNewFolderTitle(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter") createFolder();
                                        if (e.key === "Escape") setIsCreatingFolder(false);
                                    }}
                                    onBlur={createFolder}
                                />
                            ) : (
                                <button className="newFolderBtn" onClick={() => setIsCreatingFolder(true)}>
                                    <i className="fa-solid fa-plus"></i> New Folder
                                </button>
                            )}
                        </div>
                    </>
                )}
            </ul>
        </section>
        </>
    );
}

export default Sidebar;