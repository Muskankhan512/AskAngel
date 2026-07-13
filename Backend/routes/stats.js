import express from "express";
import Thread from "../models/Thread.js";
import User from "../models/User.js";
import authMiddleware from "../middleware/auth.js";

const router = express.Router();

router.get("/", authMiddleware, async (req, res) => {
    try {
        const user = await User.findById(req.userId);
        if (!user) return res.status(404).json({ error: "User not found" });

        const threads = await Thread.find({ userId: req.userId });

        let totalMessages = 0;
        const personaCounts = {};
        const messagesPerDay = {};

        // Calculate last 7 days keys
        for (let i = 6; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            const dateString = d.toISOString().split('T')[0];
            messagesPerDay[dateString] = 0;
        }

        threads.forEach(thread => {
            // Most used persona logic
            const personaName = thread.persona || "Default Assistant";
            personaCounts[personaName] = (personaCounts[personaName] || 0) + 1;

            // Messages stats
            thread.messages.forEach(msg => {
                totalMessages++;
                
                // Group by day for the last 7 days
                const dateString = new Date(msg.timestamp).toISOString().split('T')[0];
                if (messagesPerDay[dateString] !== undefined) {
                    messagesPerDay[dateString]++;
                }
            });
        });

        let mostUsedPersona = "None";
        let maxCount = 0;
        for (const [p, count] of Object.entries(personaCounts)) {
            if (count > maxCount) {
                maxCount = count;
                mostUsedPersona = p;
            }
        }

        res.json({
            totalThreads: threads.length,
            totalMessages,
            mostUsedPersona,
            accountCreationDate: user.createdAt,
            messagesPerDay
        });
    } catch (err) {
        console.error("Stats error:", err);
        res.status(500).json({ error: "Failed to fetch stats" });
    }
});

export default router;
