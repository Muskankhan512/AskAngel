import express from "express";
import Thread from "../models/Thread.js";
import User from "../models/User.js";
import { geminiChatStream, generateTitle } from "../utils/gemini.js";
import authMiddleware from "../middleware/auth.js";

const router = express.Router();

// All routes below are protected — require valid JWT
router.use(authMiddleware);

// Get all threads for the logged-in user
router.get("/thread", async (req, res) => {
    try {
        const threads = await Thread.find({ userId: req.userId }).sort({ updatedAt: -1 });
        res.json(threads);
    } catch (err) {
        console.log(err);
        res.status(500).json({ error: "Failed to fetch threads" });
    }
});

// Get a single thread's messages (only if it belongs to this user)
router.get("/thread/:threadId", async (req, res) => {
    const { threadId } = req.params;
    try {
        const thread = await Thread.findOne({ threadId, userId: req.userId });
        if (!thread) return res.status(404).json({ error: "Thread not found" });
        res.json(thread);
    } catch (err) {
        console.log(err);
        res.status(500).json({ error: "Failed to fetch chat" });
    }
});

// Delete a thread (only if it belongs to this user)
router.delete("/thread/:threadId", async (req, res) => {
    const { threadId } = req.params;
    try {
        const deleted = await Thread.findOneAndDelete({ threadId, userId: req.userId });
        if (!deleted) return res.status(404).json({ error: "Thread not found" });
        res.status(200).json({ success: "Thread deleted successfully" });
    } catch (err) {
        console.log(err);
        res.status(500).json({ error: "Failed to delete thread" });
    }
});

// Rename a thread (only if it belongs to this user)
router.patch("/thread/:threadId", async (req, res) => {
    const { threadId } = req.params;
    const { title } = req.body;
    if (!title || !title.trim()) return res.status(400).json({ error: "Title cannot be empty" });
    try {
        const thread = await Thread.findOneAndUpdate(
            { threadId, userId: req.userId },
            { title: title.trim(), updatedAt: new Date() },
            { new: true }
        );
        if (!thread) return res.status(404).json({ error: "Thread not found" });
        res.status(200).json({ success: "Thread renamed successfully", title: thread.title });
    } catch (err) {
        console.log(err);
        res.status(500).json({ error: "Failed to rename thread" });
    }
});

// Toggle pin a thread (only if it belongs to this user)
router.patch("/thread/:threadId/pin", async (req, res) => {
    const { threadId } = req.params;
    try {
        const thread = await Thread.findOne({ threadId, userId: req.userId });
        if (!thread) return res.status(404).json({ error: "Thread not found" });
        
        thread.isPinned = !thread.isPinned;
        await thread.save();
        
        res.status(200).json({ success: "Thread pin toggled successfully", isPinned: thread.isPinned });
    } catch (err) {
        console.log(err);
        res.status(500).json({ error: "Failed to toggle pin" });
    }
});

// ── SEARCH chat route ──
router.get("/chat/search", async (req, res) => {
    const { q } = req.query;
    if (!q || !q.trim()) return res.status(400).json({ error: "Search query is required" });
    
    try {
        const queryTerm = q.trim();
        const threads = await Thread.find({
            userId: req.userId,
            $or: [
                { title: { $regex: queryTerm, $options: "i" } },
                { "messages.content": { $regex: queryTerm, $options: "i" } }
            ]
        }).sort({ updatedAt: -1 });
        
        res.json(threads);
    } catch (err) {
        console.log(err);
        res.status(500).json({ error: "Search failed" });
    }
});

// ── STREAMING chat route using SSE ──
router.post("/chat", async (req, res) => {
    const { threadId, message, language, persona = 'Default Assistant', model = "gemini-flash-latest" } = req.body;
    if (!threadId || !message) return res.status(400).json({ error: "Missing required fields" });

    try {
        const user = await User.findById(req.userId);
        if (!user) return res.status(404).json({ error: "User not found" });

        const now = new Date();
        const lastDate = new Date(user.lastMessageDate);
        if (now.toDateString() !== lastDate.toDateString()) {
            user.messageCountToday = 0;
        }

        if (user.messageCountToday >= 50) {
            return res.status(429).json({ error: "You've reached your daily message limit. Please try again tomorrow." });
        }

        user.messageCountToday += 1;
        user.lastMessageDate = now;
        await user.save();

        // SSE headers — tell the browser this is a stream
        res.setHeader("Content-Type", "text/event-stream");
        res.setHeader("Cache-Control", "no-cache");
        res.setHeader("Connection", "keep-alive");
        res.flushHeaders();

        // Send quota update as the first SSE event
        res.write(`data: ${JSON.stringify({ type: 'quota', messageCountToday: user.messageCountToday })}\n\n`);

        // Find or create thread
        let isNewThread = false;
        let thread = await Thread.findOne({ threadId, userId: req.userId });
        if (!thread) {
            isNewThread = true;
            thread = new Thread({
                threadId,
                userId: req.userId,
                title: message.slice(0, 60),
                persona,
                messages: [{ role: "user", content: message }]
            });
        } else {
            thread.messages.push({ role: "user", content: message });
        }

        // Pass entire message history to groqChatStream
        const activePersona = thread.persona || persona;
        const { fullReply, searchMetadata } = await geminiChatStream(thread.messages, activePersona, language, res, model);

        // Save full assembled reply to MongoDB
        const newAssistantMessage = { 
            role: "assistant", 
            content: fullReply 
        };

        if (searchMetadata) {
            newAssistantMessage.searchQuery = searchMetadata.query;
            newAssistantMessage.searchSources = searchMetadata.sources;
        }

        thread.messages.push(newAssistantMessage);
        thread.updatedAt = new Date();
        await thread.save();

        // Signal stream end
        res.write(`data: [DONE]\n\n`);
        res.end();

        // Background title generation for new threads
        if (isNewThread) {
            generateTitle(message).then(async (newTitle) => {
                thread.title = newTitle;
                await thread.save();
            }).catch(err => console.error("Background title generation failed:", err));
        }

    } catch (err) {
        console.log(err);
        res.write(`data: ${JSON.stringify({ error: "Something went wrong" })}\n\n`);
        res.end();
    }
});

// ── EDIT message route ──
router.put("/chat/edit", async (req, res) => {
    const { threadId, messageIndex, message, language, persona = 'Default Assistant', model = "gemini-flash-latest" } = req.body;
    if (!threadId || typeof messageIndex !== 'number' || !message) {
        return res.status(400).json({ error: "Missing required fields" });
    }

    try {
        const user = await User.findById(req.userId);
        if (!user) return res.status(404).json({ error: "User not found" });

        const now = new Date();
        const lastDate = new Date(user.lastMessageDate);
        if (now.toDateString() !== lastDate.toDateString()) {
            user.messageCountToday = 0;
        }

        if (user.messageCountToday >= 50) {
            return res.status(429).json({ error: "You've reached your daily message limit. Please try again tomorrow." });
        }

        user.messageCountToday += 1;
        user.lastMessageDate = now;
        await user.save();

        res.setHeader("Content-Type", "text/event-stream");
        res.setHeader("Cache-Control", "no-cache");
        res.setHeader("Connection", "keep-alive");
        res.flushHeaders();

        res.write(`data: ${JSON.stringify({ type: 'quota', messageCountToday: user.messageCountToday })}\n\n`);

        let thread = await Thread.findOne({ threadId, userId: req.userId });
        if (!thread) {
            res.write(`data: ${JSON.stringify({ error: "Thread not found" })}\n\n`);
            return res.end();
        }

        // Truncate messages up to the index, then push the edited message
        thread.messages = thread.messages.slice(0, messageIndex);
        thread.messages.push({ role: "user", content: message });

        const activePersona = thread.persona || persona;
        const { fullReply, searchMetadata } = await geminiChatStream(thread.messages, activePersona, language, res, model);

        const newAssistantMessage = { 
            role: "assistant", 
            content: fullReply 
        };

        if (searchMetadata) {
            newAssistantMessage.searchQuery = searchMetadata.query;
            newAssistantMessage.searchSources = searchMetadata.sources;
        }

        thread.messages.push(newAssistantMessage);
        thread.updatedAt = new Date();
        await thread.save();

        res.write(`data: [DONE]\n\n`);
        res.end();

    } catch (err) {
        console.log(err);
        res.write(`data: ${JSON.stringify({ error: "Something went wrong" })}\n\n`);
        res.end();
    }
});

// ── REGENERATE message route ──
router.post("/chat/regenerate", async (req, res) => {
    const { threadId, aiMessageIndex, language, persona = 'Default Assistant', model = "gemini-flash-latest" } = req.body;
    if (!threadId || typeof aiMessageIndex !== 'number') {
        return res.status(400).json({ error: "Missing required fields" });
    }

    try {
        const user = await User.findById(req.userId);
        if (!user) return res.status(404).json({ error: "User not found" });

        const now = new Date();
        const lastDate = new Date(user.lastMessageDate);
        if (now.toDateString() !== lastDate.toDateString()) {
            user.messageCountToday = 0;
        }

        if (user.messageCountToday >= 50) {
            return res.status(429).json({ error: "You've reached your daily message limit. Please try again tomorrow." });
        }

        user.messageCountToday += 1;
        user.lastMessageDate = now;
        await user.save();

        res.setHeader("Content-Type", "text/event-stream");
        res.setHeader("Cache-Control", "no-cache");
        res.setHeader("Connection", "keep-alive");
        res.flushHeaders();

        res.write(`data: ${JSON.stringify({ type: 'quota', messageCountToday: user.messageCountToday })}\n\n`);

        let thread = await Thread.findOne({ threadId, userId: req.userId });
        if (!thread) {
            res.write(`data: ${JSON.stringify({ error: "Thread not found" })}\n\n`);
            return res.end();
        }

        // Truncate messages exactly at the AI message index (discarding the old AI message and anything after)
        // Since aiMessageIndex is the index of the old AI response, slicing up to it keeps the user message at aiMessageIndex - 1.
        thread.messages = thread.messages.slice(0, aiMessageIndex);

        const activePersona = thread.persona || persona;
        
        // Pass the truncated message history (which ends with the user's last message) to Groq/Gemini
        const { fullReply, searchMetadata } = await geminiChatStream(thread.messages, activePersona, language, res, model);

        const newAssistantMessage = { 
            role: "assistant", 
            content: fullReply 
        };

        if (searchMetadata) {
            newAssistantMessage.searchQuery = searchMetadata.query;
            newAssistantMessage.searchSources = searchMetadata.sources;
        }

        thread.messages.push(newAssistantMessage);
        thread.updatedAt = new Date();
        await thread.save();

        res.write(`data: [DONE]\n\n`);
        res.end();
    } catch (err) {
        console.log(err);
        res.write(`data: ${JSON.stringify({ error: "Something went wrong" })}\n\n`);
        res.end();
    }
});

// ── REACTION route ──
router.patch("/chat/:threadId/message/:messageIndex/reaction", async (req, res) => {
    const { threadId, messageIndex } = req.params;
    const { reaction } = req.body; // "like", "dislike", or null

    try {
        const thread = await Thread.findOne({ threadId, userId: req.userId });
        if (!thread) return res.status(404).json({ error: "Thread not found" });

        const idx = parseInt(messageIndex, 10);
        if (isNaN(idx) || idx < 0 || idx >= thread.messages.length) {
            return res.status(400).json({ error: "Invalid message index" });
        }

        thread.messages[idx].reaction = reaction;
        await thread.save();

        res.json({ success: true, reaction: thread.messages[idx].reaction });
    } catch (err) {
        console.log(err);
        res.status(500).json({ error: "Failed to update reaction" });
    }
});

// ── BOOKMARK route ──
router.patch("/chat/:threadId/message/:messageIndex/bookmark", async (req, res) => {
    const { threadId, messageIndex } = req.params;
    const { isBookmarked } = req.body; 

    try {
        const thread = await Thread.findOne({ threadId, userId: req.userId });
        if (!thread) return res.status(404).json({ error: "Thread not found" });

        const idx = parseInt(messageIndex, 10);
        if (isNaN(idx) || idx < 0 || idx >= thread.messages.length) {
            return res.status(400).json({ error: "Invalid message index" });
        }

        thread.messages[idx].isBookmarked = isBookmarked;
        await thread.save();

        res.json({ success: true, isBookmarked: thread.messages[idx].isBookmarked });
    } catch (err) {
        console.log(err);
        res.status(500).json({ error: "Failed to update bookmark" });
    }
});

// ── GET BOOKMARKS route ──
router.get("/bookmarks", async (req, res) => {
    try {
        const threads = await Thread.find({ userId: req.userId });
        const bookmarks = [];
        
        threads.forEach(thread => {
            thread.messages.forEach((msg, idx) => {
                if (msg.isBookmarked) {
                    bookmarks.push({
                        threadId: thread.threadId,
                        threadTitle: thread.title,
                        messageIndex: idx,
                        role: msg.role,
                        content: msg.content,
                        timestamp: msg.timestamp
                    });
                }
            });
        });

        // Sort bookmarks descending by timestamp
        bookmarks.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

        res.json(bookmarks);
    } catch (err) {
        console.log(err);
        res.status(500).json({ error: "Failed to fetch bookmarks" });
    }
});

export default router;