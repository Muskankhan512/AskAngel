import "dotenv/config";
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const logGeminiCall = (model, trigger) => {
    const timestamp = new Date().toISOString();
    console.log(`\n[GEMINI_API_CALL] | Timestamp: ${timestamp} | Model: ${model} | Trigger: ${trigger}\n`);
};

const withTimeout = (promise, milliseconds) => Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error("Gemini request timed out")), milliseconds))
]);

const tools = [
    {
        functionDeclarations: [
            {
                name: "web_search",
                description: "Search the web for current events, news, or real-time information that you don't know.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        query: {
                            type: "STRING",
                            description: "The exact search query to look up on the web."
                        }
                    },
                    required: ["query"]
                }
            },
            {
                name: "generate_image",
                description: "Generate an AI image based on a prompt. ONLY call this tool if the user EXPLICITLY requests the creation of an image. IMPORTANT: Do NOT generate images of real identifiable people (celebrities, politicians, etc.). If the user asks for a real person, do NOT call this tool, and instead reply in chat that you cannot generate images of real people due to privacy. Do NOT call this tool for general conversation. If unsure, default to a normal text response.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        prompt: {
                            type: "STRING",
                            description: "A detailed description of the image to generate."
                        }
                    },
                    required: ["prompt"]
                }
            }
        ]
    }
];

// Helper to execute Tavily search
async function executeWebSearch(query) {
    try {
        const response = await fetch("https://api.tavily.com/search", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                api_key: process.env.TAVILY_API_KEY,
                query: query,
                search_depth: "basic",
                include_answer: false,
                max_results: 3
            })
        });
        
        if (!response.ok) throw new Error("Tavily API error");
        
        const data = await response.json();
        return data.results || [];
    } catch (err) {
        console.error("Web search failed:", err);
        return [];
    }
}

export const geminiChatStream = async (messageHistory, persona, language, res, model = "gemini-flash-lite-latest") => {
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
        "Coding Assistant": "You are an expert programmer. Give clear, concise code explanations and working code examples. Always wrap code in fenced code blocks with the correct language specified (e.g. ```python, ```javascript).",
        "Friendly Tutor": "You are a patient, encouraging tutor who explains concepts simply with examples, as if teaching a student.",
        "Motivational Coach": "You are an energetic motivational coach who gives encouraging, actionable advice.",
        "Doctor Advisor": "You are a knowledgeable health information assistant. Provide general health information but always remind the user to consult a real doctor for diagnosis or treatment."
    };

    const markdownInstructions = `\nFORMATTING RULES — ALWAYS FOLLOW THESE:
- Use proper markdown formatting in all responses.
- Use ## or ### headings to structure long answers (not for simple one-liners).
- Use bullet points (- item) or numbered lists (1. item) whenever you list multiple things.
- Bold (**text**) important terms or key concepts.
- Use fenced code blocks with a language tag (e.g. \`\`\`python) for ANY code snippet, even short ones.
- For comparisons, use a markdown table.
- Keep paragraphs concise. Avoid walls of text.`;

    const targetPersona = personaMap[persona] || personaMap["Default Assistant"];
    
    let languageInstruction = "";
    if (language && language !== 'auto' && langMap[language]) {
        languageInstruction = `Respond primarily in ${langMap[language]}, but ALWAYS respect the user's explicit instructions if they ask you to speak in a different language (e.g., 'reply in Hinglish' or 'speak in Hindi').`;
    } else {
        languageInstruction = `Match the language and style of the user's prompt (e.g. if they write in Hinglish, reply in Hinglish. If they write in Hindi, reply in Hindi. If English, reply in English). ALWAYS respect the user's explicit language requests.`;
    }

    const systemPrompt = `${targetPersona}${markdownInstructions}
${languageInstruction}

IMPORTANT INSTRUCTION FOR TOOL USAGE:
1. ONLY use the web_search tool if the user explicitly asks a question requiring real-time information or facts you do not know. DO NOT use the web_search tool for casual conversational messages.
2. YOU CAN GENERATE IMAGES. You have access to the \`generate_image\` tool. If the user asks for a picture, photo, image, drawing, or painting, use the \`generate_image\` tool. NEVER say "I cannot copy images from the internet". However, you MUST NOT generate images of real identifiable people. If they ask for a real person, refuse in chat and do NOT call the tool.`;

    const formattedMessages = messageHistory.map(m => {
        // Handle images in messages if they exist
        const parts = [{ text: m.content || "" }];
        
        // We'll map the role. System role is not allowed in contents array for Gemini, it uses systemInstruction.
        // User is "user", assistant is "model".
        return {
            role: m.role === "assistant" ? "model" : "user",
            parts: parts
        };
    }).filter(m => m.role !== "system"); // Filter out system messages just in case

    console.log(`\n======================================================`);
    console.log(`[geminiChatStream] Using Gemini model for this request: ${model}`);
    console.log(`======================================================\n`);

    const modelInstance = genAI.getGenerativeModel({ 
        model: model,
        systemInstruction: systemPrompt
    });

    let fullReply = "";
    let searchMetadata = null; 

    const req = { contents: formattedMessages };
    
    // Helper to retry API calls on 503 errors only
    const executeWithRetry = async (apiCallFn) => {
        try {
            return await apiCallFn();
        } catch (e) {
            if (e.message && e.message.includes("503")) {
                console.log("Gemini API busy (503). Retrying in 2.5 seconds...");
                await new Promise(resolve => setTimeout(resolve, 2500));
                return await apiCallFn();
            }
            // For 429 Rate Limits and other errors, fail immediately.
            throw e;
        }
    };

    try {
        logGeminiCall(model, "geminiChat - response");
        const result = await executeWithRetry(() => withTimeout(modelInstance.generateContent(req), 12000));
        fullReply = result.response.text();
        if (res && typeof res.write === "function") {
            res.write(`data: ${JSON.stringify({ token: fullReply })}\n\n`);
        }
    } catch (e) {
        console.error("Gemini chat error:", e.message);
        if (res && typeof res.write === "function") {
            const userFriendlyError = e.message?.includes("429")
                ? "AI usage limit reached. Please try again later."
                : e.message?.includes("404")
                    ? "The selected AI model is unavailable. Please choose another model."
                    : e.message?.includes("timed out")
                        ? "Gemini is taking too long to respond. Please try again."
                    : "The AI service is temporarily unavailable. Please try again.";
            res.write(`data: ${JSON.stringify({ error: userFriendlyError })}\n\n`);
        }
    }

    return { fullReply, searchMetadata };
};

export const generateTitle = async (message) => {
    try {
        // Fast, no-API heuristic title generation
        const limit = 45;
        if (message.length <= limit) return message;
        
        let truncated = message.slice(0, limit);
        // Try to trim to the nearest complete word
        const lastSpace = truncated.lastIndexOf(' ');
        if (lastSpace > 0) {
            truncated = truncated.slice(0, lastSpace);
        }
        return truncated + "...";
    } catch (err) {
        return message.slice(0, 45) + "...";
    }
};
