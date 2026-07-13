import express from "express";
import Folder from "../models/Folder.js";
import Thread from "../models/Thread.js";
import authMiddleware from "../middleware/auth.js";

const router = express.Router();

// All routes below are protected
router.use(authMiddleware);

// Get all folders for the logged-in user
router.get("/folder", async (req, res) => {
    try {
        const folders = await Folder.find({ userId: req.userId }).sort({ createdAt: 1 });
        res.json(folders);
    } catch (err) {
        console.log(err);
        res.status(500).json({ error: "Failed to fetch folders" });
    }
});

// Create a new folder
router.post("/folder", async (req, res) => {
    try {
        const { name } = req.body;
        if (!name || !name.trim()) return res.status(400).json({ error: "Folder name cannot be empty" });
        
        const folder = new Folder({ name: name.trim(), userId: req.userId });
        await folder.save();
        
        res.status(201).json(folder);
    } catch (err) {
        console.log(err);
        res.status(500).json({ error: "Failed to create folder" });
    }
});

// Rename a folder
router.patch("/folder/:folderId", async (req, res) => {
    const { folderId } = req.params;
    const { name } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: "Folder name cannot be empty" });
    
    try {
        const folder = await Folder.findOneAndUpdate(
            { _id: folderId, userId: req.userId },
            { name: name.trim() },
            { new: true }
        );
        if (!folder) return res.status(404).json({ error: "Folder not found" });
        
        res.status(200).json(folder);
    } catch (err) {
        console.log(err);
        res.status(500).json({ error: "Failed to rename folder" });
    }
});

// Delete a folder (move threads to uncategorized)
router.delete("/folder/:folderId", async (req, res) => {
    const { folderId } = req.params;
    
    try {
        const deleted = await Folder.findOneAndDelete({ _id: folderId, userId: req.userId });
        if (!deleted) return res.status(404).json({ error: "Folder not found" });
        
        // Move all threads in this folder back to uncategorized (null)
        await Thread.updateMany({ folderId, userId: req.userId }, { folderId: null });
        
        res.status(200).json({ success: "Folder deleted successfully" });
    } catch (err) {
        console.log(err);
        res.status(500).json({ error: "Failed to delete folder" });
    }
});

// Move a thread to a folder
router.patch("/thread/:threadId/folder", async (req, res) => {
    const { threadId } = req.params;
    const { folderId } = req.body; // folderId can be null
    
    try {
        const thread = await Thread.findOneAndUpdate(
            { threadId, userId: req.userId },
            { folderId },
            { new: true }
        );
        if (!thread) return res.status(404).json({ error: "Thread not found" });
        
        res.status(200).json({ success: "Thread moved successfully", folderId: thread.folderId });
    } catch (err) {
        console.log(err);
        res.status(500).json({ error: "Failed to move thread" });
    }
});

export default router;
