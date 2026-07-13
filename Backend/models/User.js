import mongoose from "mongoose";

const UserSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true
    },
    password: {
        type: String,
        required: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    avatar: {
        type: String, // Will store base64 data URI or simple URL
        default: ""
    },
    hasSeenOnboarding: {
        type: Boolean,
        default: false
    },
    messageCountToday: {
        type: Number,
        default: 0
    },
    lastMessageDate: {
        type: Date,
        default: Date.now
    }
});

export default mongoose.model("User", UserSchema);
