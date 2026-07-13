import mongoose from "mongoose";

const MessageSchema = new mongoose.Schema({
    role: {
        type: String,
        enum: ["user", "assistant"],
        required: true
    },
    content: {
        type: String,
        required: true
    },
    timestamp: {
        type: Date,
        default: Date.now
    },
    searchQuery: {
        type: String
    },
    searchSources: {
        type: Array // array of objects { title, url, content }
    },
    reaction: {
        type: String,
        enum: ["like", "dislike", null],
        default: null
    },
    isBookmarked: {
        type: Boolean,
        default: false
    }
});

const ThreadSchema = new mongoose.Schema({
    threadId: {
        type: String,
        required: true,
        unique: true
    },
    userId: {
        type: String,
        required: true
    },
    title: {
        type: String,
        default: "New Chat"
    },
    isPinned: {
        type: Boolean,
        default: false
    },
    persona: {
        type: String,
        default: "Default Assistant"
    },
    folderId: {
        type: String,
        default: null
    },
    shareId: {
        type: String,
        unique: true,
        sparse: true
    },
    isPublic: {
        type: Boolean,
        default: false
    },
    messages: [MessageSchema],
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

export default mongoose.model("Thread", ThreadSchema);