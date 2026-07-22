import "dotenv/config";
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

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
                description: "Generate an AI image based on a prompt. ONLY call this tool if the user EXPLICITLY and CLEARLY requests the creation of an image (e.g., 'generate an image of...', 'create a picture showing...', 'draw a...', 'make an image', 'banao ek image...'). Do NOT call this tool for general conversation, questions, greetings, or casual remarks (like 'kya kar rahe ho', 'how are you', etc.). If unsure, default to a normal text response.",
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

export const geminiChatStream = async (messageHistory, persona, language, res, model = "gemini-flash-latest") => {
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
    const systemPrompt = `${targetPersona}${markdownInstructions}
Always respond in ${targetLang}, regardless of what language the user writes in.

IMPORTANT INSTRUCTION FOR TOOL USAGE:
1. ONLY use the web_search tool if the user explicitly asks a question requiring real-time information or facts you do not know. DO NOT use the web_search tool for casual conversational messages.
2. YOU CAN GENERATE IMAGES. You have access to the \`generate_image\` tool. If the user asks for a picture, photo, image, drawing, or painting (in any language, including Hindi/Hinglish), you MUST IMMEDIATELY use the \`generate_image\` tool. NEVER say "I cannot copy images from the internet". NEVER ask for permission to generate an image. Just call the tool and let the system handle it.`;

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

    const modelInstance = genAI.getGenerativeModel({ 
        model: model,
        systemInstruction: systemPrompt,
        tools: tools
    });

    let fullReply = "";
    let searchMetadata = null; 

    const req = { contents: formattedMessages };
    
    // Helper to retry API calls on rate limit or 503 errors
    const executeWithRetry = async (apiCallFn) => {
        try {
            return await apiCallFn();
        } catch (e) {
            const isRateLimit = e.message.includes("Quota exceeded") || e.message.includes("429") || e.message.includes("503");
            if (isRateLimit) {
                console.log("Gemini API busy or rate limit hit. Retrying in 2.5 seconds...");
                await new Promise(resolve => setTimeout(resolve, 2500));
                return await apiCallFn();
            }
            throw e;
        }
    };

    try {
        let streamResult = await executeWithRetry(() => modelInstance.generateContentStream(req));
        
        let isFunctionCall = false;
        let functionCalls = [];

        // Try streaming first
        for await (const chunk of streamResult.stream) {
            const calls = chunk.functionCalls();
            if (calls && calls.length > 0) {
                isFunctionCall = true;
                functionCalls = functionCalls.concat(calls);
                break; // Stop streaming text, we need to handle the function
            }
            try {
                const text = chunk.text();
                if (text) {
                    fullReply += text;
                    if (res && typeof res.write === "function") {
                        res.write(`data: ${JSON.stringify({ token: text })}\n\n`);
                    }
                }
            } catch (e) {}
        }

        if (isFunctionCall) {
            // Get the full model response to append to history
            const response = await streamResult.response;
            const modelMessage = response.candidates[0].content;

            let combinedSources = [];
            let combinedQuery = "";
            let functionResponses = [];

            // Execute all function calls concurrently
            const toolExecutions = functionCalls.map(async (tc) => {
                if (tc.name === "web_search") {
                    const query = tc.args.query;
                    if (query) {
                        if (res && typeof res.write === "function") {
                            res.write(`data: ${JSON.stringify({ type: "search_started", query })}\n\n`);
                        }
                        const results = await executeWebSearch(query);
                        return { id: tc.id, name: tc.name, query, results };
                    }
                } else if (tc.name === "generate_image") {
                    const imgPrompt = tc.args.prompt || "image";

                    // ── SAFETY CHECK FOR REAL PEOPLE ──
                    const checkModel = genAI.getGenerativeModel({ model: "gemini-flash-lite-latest" });
                    const checkPrompt = `Does this image generation prompt ask for an image of a real, identifiable person (like a celebrity, public figure, politician, actor, or named individual)? Answer only YES or NO.\nPrompt: "${imgPrompt}"`;
                    
                    try {
                        const checkRes = await checkModel.generateContent(checkPrompt);
                        const answer = checkRes.response.text().trim().toUpperCase();
                        
                        if (answer.includes("YES")) {
                            const rejectionMsg = `\n\nMain real logon ki tasveer generate nahi kar sakti privacy aur likeness rights ki wajah se. Lekin main iss style ka fictional character bana sakti hoon — batao kaisa look chahiye?\n\n`;
                            if (res && typeof res.write === "function") {
                                res.write(`data: ${JSON.stringify({ token: rejectionMsg })}\n\n`);
                                fullReply += rejectionMsg; // Save to history
                            }
                            // Return BLOCKED to the main model so it doesn't hallucinate a success
                            return { id: tc.id, name: tc.name, query: imgPrompt, results: [{ content: "BLOCKED_REAL_PERSON" }], blocked: true };
                        }
                    } catch (e) {
                        console.error("Safety check failed, defaulting to allow", e);
                    }

                    // ── IF SAFE, GENERATE URL AND STREAM MARKDOWN ──
                    const imageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(imgPrompt)}?width=1024&height=1024&nologo=true`;
                    const md = `\n\n![${imgPrompt}](${imageUrl})\n\n`;
                    
                    // Stream the markdown immediately so it renders in the chat UI
                    if (res && typeof res.write === "function") {
                        res.write(`data: ${JSON.stringify({ token: md })}\n\n`);
                        fullReply += md; // Append markdown to the actual message history
                    }

                    return { id: tc.id, name: tc.name, query: imgPrompt, results: [{ content: md }] };
                }
                return { id: tc.id, name: tc.name, query: null, results: [] };
            });

            const resolvedTools = await Promise.all(toolExecutions);

            for (const resolved of resolvedTools) {
                const results = resolved.results;
                
                let toolResultObj = {};
                if (resolved.name === "web_search") {
                    if (resolved.query) combinedQuery += (combinedQuery ? ", " : "") + resolved.query;
                    combinedSources.push(...results);
                    toolResultObj = results.length > 0 
                        ? { sources: results }
                        : { error: "No relevant information found." };
                } else if (resolved.name === "generate_image") {
                    toolResultObj = {
                        status: "SUCCESS",
                        message: "The image has been generated.",
                        markdown_to_display: results[0].content
                    };
                }

                let functionResponsePart = {
                    name: resolved.name,
                    response: toolResultObj
                };
                
                // Newer Gemini API versions require the id to match the functionCall
                if (resolved.id) {
                    functionResponsePart.id = resolved.id;
                }

                functionResponses.push({
                    functionResponse: functionResponsePart
                });
            }

            if (combinedSources.length > 0) {
                searchMetadata = { query: combinedQuery, sources: combinedSources };
                if (res && typeof res.write === "function") {
                    res.write(`data: ${JSON.stringify({ type: "search_completed", sources: combinedSources })}\n\n`);
                }
            }

            // ── BYPASS thought_signature VALIDATOR ──
            // Newer Gemini models require a thought_signature in the functionCall. 
            // If the SDK strips it, returning the call throws a 400 Bad Request.
            // Google explicitly supports this string to bypass the strict check.
            if (modelMessage && Array.isArray(modelMessage.parts)) {
                modelMessage.parts.forEach(part => {
                    if (part.functionCall) {
                        part.thoughtSignature = "skip_thought_signature_validator";
                        // Also clear any previous incorrect bypass just in case
                        delete part.functionCall.thought_signature;
                    }
                });
            }

            // Start 2nd Stream with function response
            const newContents = [
                ...formattedMessages,
                modelMessage,
                {
                    role: "user", 
                    parts: functionResponses
                }
            ];

            const stream2 = await executeWithRetry(() => modelInstance.generateContentStream({ contents: newContents }));
            
            for await (const chunk of stream2.stream) {
                try {
                    const text = chunk.text();
                    if (text) {
                        fullReply += text;
                        if (res && typeof res.write === "function") {
                            res.write(`data: ${JSON.stringify({ token: text })}\n\n`);
                        }
                    }
                } catch (e) {}
            }
        }
    } catch (e) {
        console.error("Gemini chat error:", e.message);
        if (res && typeof res.write === "function") {
            const userFriendlyError = e.message.includes("Quota exceeded") || e.message.includes("429") 
                ? "Gemini API rate limit reached. Please wait a moment and try again." 
                : e.message;
            res.write(`data: ${JSON.stringify({ error: userFriendlyError })}\n\n`);
        }
    }

    return { fullReply, searchMetadata };
};

export const generateTitle = async (message) => {
    try {
        const modelInstance = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const response = await modelInstance.generateContent({
            contents: [{ role: "user", parts: [{ text: message }] }],
            systemInstruction: "You are a title generator. Generate a very short, smart title (3 to 6 words maximum) summarizing the user's prompt. Do not use quotes around the title. Do not provide any conversational text or formatting."
        });
        
        let generated = response.response.text().trim() || "";
        generated = generated.replace(/^["'](.*)["']$/, '$1');
        return generated || message.slice(0, 60);
    } catch (err) {
        console.error("Failed to generate title:", err);
        return message.slice(0, 60);
    }
};
