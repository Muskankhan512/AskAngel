import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import authMiddleware from "../middleware/auth.js";

const router = express.Router();

// Helper: generate JWT
const generateToken = (userId) => {
    return jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: "7d" });
};

// POST /api/auth/signup
router.post("/signup", async (req, res) => {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
        return res.status(400).json({ error: "All fields are required." });
    }
    if (password.length < 6) {
        return res.status(400).json({ error: "Password must be at least 6 characters." });
    }

    try {
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(409).json({ error: "An account with this email already exists." });
        }

        const hashedPassword = await bcrypt.hash(password, 12);
        const user = new User({ name, email, password: hashedPassword });
        await user.save();

        const token = generateToken(user._id.toString());
        res.status(201).json({
            token,
            user: { id: user._id, name: user.name, email: user.email, avatar: user.avatar || "", hasSeenOnboarding: user.hasSeenOnboarding, messageCountToday: user.messageCountToday }
        });
    } catch (err) {
        console.log(err);
        res.status(500).json({ error: "Signup failed. Please try again." });
    }
});

// POST /api/auth/login
router.post("/login", async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: "Email and password are required." });
    }

    try {
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(401).json({ error: "Invalid email or password." });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ error: "Invalid email or password." });
        }

        const token = generateToken(user._id.toString());
        res.json({
            token,
            user: { id: user._id, name: user.name, email: user.email, avatar: user.avatar || "", hasSeenOnboarding: user.hasSeenOnboarding, messageCountToday: user.messageCountToday }
        });
    } catch (err) {
        console.log(err);
        res.status(500).json({ error: "Login failed. Please try again." });
    }
});

// PATCH /api/auth/profile
router.patch("/profile", authMiddleware, async (req, res) => {
    const { name, avatar } = req.body;
    try {
        const user = await User.findById(req.userId);
        if (!user) return res.status(404).json({ error: "User not found." });

        if (name) user.name = name;
        if (avatar !== undefined) user.avatar = avatar;
        await user.save();

        res.json({ user: { id: user._id, name: user.name, email: user.email, avatar: user.avatar, hasSeenOnboarding: user.hasSeenOnboarding, messageCountToday: user.messageCountToday } });
    } catch (err) {
        console.log(err);
        res.status(500).json({ error: "Failed to update profile." });
    }
});

// POST /api/auth/onboarding-complete
router.post("/onboarding-complete", authMiddleware, async (req, res) => {
    try {
        const user = await User.findById(req.userId);
        if (!user) return res.status(404).json({ error: "User not found." });

        user.hasSeenOnboarding = true;
        await user.save();

        res.json({ success: true });
    } catch (err) {
        console.log(err);
        res.status(500).json({ error: "Failed to update onboarding status." });
    }
});

export default router;
