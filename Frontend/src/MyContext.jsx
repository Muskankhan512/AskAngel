import { createContext, useState, useEffect } from "react";

export const MyContext = createContext("");

export const MyProvider = ({ children }) => {
    const [currThreadId, setCurrThreadId] = useState("");
    const [allThreads, setAllThreads] = useState([]);

    const [language, setLanguage] = useState(localStorage.getItem("language") || "en");
    const [persona, setPersona] = useState("Default Assistant");

    useEffect(() => {
        localStorage.setItem("language", language);
    }, [language]);

    const contextValue = {
        prompt, setPrompt,
        reply, setReply,
        newChat, setNewChat,
        loading, setLoading,
        prevChats, setPrevChats,
        isStreaming, setIsStreaming,
        streamingText, setStreamingText,
        token, setToken,
        user, setUser,
        currThreadId, setCurrThreadId,
        allThreads, setAllThreads,
        language, setLanguage
    };

    return (
        <MyContext.Provider value={contextValue}>
            {children}
        </MyContext.Provider>
    );
};