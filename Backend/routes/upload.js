import express from "express";
import multer from "multer";
import { createRequire } from "module";
import authMiddleware from "../middleware/auth.js";
import Thread from "../models/Thread.js";
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// pdf-parse is CommonJS-only; use createRequire to load it safely in ESM
const require = createRequire(import.meta.url);
const pdfParse = require("pdf-parse");

const router = express.Router();

// Store files in memory as Buffer (no disk writes needed)
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB limit
    fileFilter: (req, file, cb) => {
        const allowed = ["image/jpeg", "image/png", "application/pdf"];
        allowed.includes(file.mimetype)
            ? cb(null, true)
            : cb(new Error("Only JPG, PNG, and PDF files are allowed."));
    }
});

router.use(authMiddleware);

// POST /api/upload — accepts file + message + threadId + language + persona
router.post("/", upload.single("file"), async (req, res) => {
    const { message, threadId, language, persona = 'Default Assistant' } = req.body;
    const file = req.file;

    if (!file) return res.status(400).json({ error: "No file uploaded." });
    if (!threadId) return res.status(400).json({ error: "threadId is required." });

    // SSE headers
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

    try {
        const isImage = file.mimetype.startsWith("image/");
        const isPDF = file.mimetype === "application/pdf";

        let groqPayload;
        const userQuestion = message?.trim() || (isImage ? "What is in this image?" : "Summarize this document.");

        const langMap = {
            'en': 'English',
            'hi': 'pure, natural Hindi (Devanagari script)',
            'pa': 'pure Punjabi (Gurmukhi script)',
            'ur': 'pure Urdu (Urdu script)',
            'mr': 'pure Marathi (Devanagari script)',
            'bn': 'pure Bengali (Bengali script)'
        };
        const targetLang = langMap[language] || 'English';

        const personaMap = {
            "Default Assistant": "You are a helpful, respectful, and honest AI assistant.",
            "Coding Assistant": "You are an expert programmer. Give clear, concise code explanations and working code examples.",
            "Friendly Tutor": "You are a patient, encouraging tutor who explains concepts simply with examples, as if teaching a student.",
            "Motivational Coach": "You are an energetic motivational coach who gives encouraging, actionable advice.",
            "Doctor Advisor": "You are a knowledgeable health information assistant. Provide general health information but always remind the user to consult a real doctor for diagnosis or treatment."
        };
        const targetPersona = personaMap[persona] || personaMap["Default Assistant"];
        const systemPrompt = `${targetPersona}\nAlways respond in ${targetLang}, regardless of what language the user writes in.`;

        let formattedMessages = [];
        let modelOptions = {
            model: "gemini-2.5-flash",
            systemInstruction: systemPrompt
        };

        if (isImage) {
            // ── Vision: base64-encode image, send to vision model ──
            const base64 = file.buffer.toString("base64");
            const mimeType = file.mimetype;

            formattedMessages = [
                {
                    role: "user",
                    parts: [
                        { text: userQuestion },
                        {
                            inlineData: {
                                data: base64,
                                mimeType: mimeType
                            }
                        }
                    ]
                }
            ];
            modelOptions.model = "gemini-2.5-pro"; // Better for vision
        } else if (isPDF) {
            // ── PDF: extract text, send as context ──
            const parsed = await pdfParse(file.buffer);
            const pdfText = parsed.text.slice(0, 12000); // cap at ~12k chars to stay within token limits

            formattedMessages = [
                {
                    role: "user",
                    parts: [
                        { text: `The user has uploaded a PDF document. Here is its extracted text content:\n\n---\n${pdfText}\n---\n\nAnswer the user's question based on this document.\n\nUser Question: ${userQuestion}` }
                    ]
                }
            ];
        }

        // Call Gemini with streaming
        const modelInstance = genAI.getGenerativeModel(modelOptions);
        const streamResult = await modelInstance.generateContentStream({ contents: formattedMessages });

        console.log("✅ Gemini stream started successfully");

        let fullReply = "";

        for await (const chunk of streamResult.stream) {
            try {
                const text = chunk.text();
                if (text) {
                    fullReply += text;
                    res.write(`data: ${JSON.stringify({ token: text })}\n\n`);
                }
            } catch (e) {}
        }

        // Save to MongoDB
        let thread = await Thread.findOne({ threadId, userId: req.userId });
        const userMsg = message?.trim()
            ? `[File: ${file.originalname}]\n${userQuestion}`
            : `[File: ${file.originalname}] ${userQuestion}`;

        if (!thread) {
            thread = new Thread({
                threadId,
                userId: req.userId,
                title: userQuestion.slice(0, 60),
                persona,
                messages: [
                    { role: "user", content: userMsg },
                    { role: "assistant", content: fullReply }
                ]
            });
        } else {
            thread.messages.push({ role: "user", content: userMsg });
            thread.messages.push({ role: "assistant", content: fullReply });
        }
        thread.updatedAt = new Date();
        await thread.save();

        res.write(`data: [DONE]\n\n`);
        res.end();

    } catch (err) {
        console.error("Upload route error:", err);
        res.write(`data: ${JSON.stringify({ error: err.message || "Something went wrong." })}\n\n`);
        res.end();
    }
});

export default router;
