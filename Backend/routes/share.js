import express from "express";
import Thread from "../models/Thread.js";
import authMiddleware from "../middleware/auth.js";
import crypto from "crypto";

const router = express.Router();

// ── PUBLIC ROUTE: Get shared thread ──
router.get("/chat/shared/:shareId", async (req, res) => {
    const { shareId } = req.params;
    try {
        const thread = await Thread.findOne({ shareId, isPublic: true });
        if (!thread) {
            return res.status(404).json({ error: "This chat is no longer available or does not exist." });
        }
        
        // Return only safe, non-sensitive data
        res.json({
            title: thread.title,
            messages: thread.messages,
            createdAt: thread.createdAt
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to fetch shared chat" });
    }
});

// ── PROTECTED ROUTES ──

// Generate share link
router.post("/chat/:threadId/share", authMiddleware, async (req, res) => {
    const { threadId } = req.params;
    try {
        let thread = await Thread.findOne({ threadId, userId: req.userId });
        if (!thread) return res.status(404).json({ error: "Thread not found" });

        // If it doesn't have a shareId yet, create one
        if (!thread.shareId) {
            thread.shareId = crypto.randomUUID();
        }
        
        thread.isPublic = true;
        await thread.save();

        res.status(200).json({ shareId: thread.shareId });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to share thread" });
    }
});

// Revoke share link
router.post("/chat/:threadId/unshare", authMiddleware, async (req, res) => {
    const { threadId } = req.params;
    try {
        const thread = await Thread.findOneAndUpdate(
            { threadId, userId: req.userId },
            { isPublic: false },
            { new: true }
        );
        
        if (!thread) return res.status(404).json({ error: "Thread not found" });

        res.status(200).json({ success: "Sharing revoked successfully" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to unshare thread" });
    }
});

export default router;
