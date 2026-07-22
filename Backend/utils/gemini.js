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
    const systemPrompt = `${targetPersona}${markdownInstructions}\nAlways respond in ${targetLang}, regardless of what language the user writes in.\nIMPORTANT INSTRUCTION FOR TOOL USAGE:\n1. ONLY use the web_search tool if the user explicitly asks a question requiring real-time information or facts you do not know. DO NOT use the web_search tool for casual conversational messages, greetings like "hello", "hi", or generic statements.\n2. ONLY use the generate_image tool for EXPLICIT requests to create an image. Do NOT use it for casual conversation, questions, or greetings like "kya kar rahe ho". If you are unsure whether the user wants an image or just to chat, DO NOT use the tool and reply normally in text.`;

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

    try {
        const req = { contents: formattedMessages };
        let streamResult = await modelInstance.generateContentStream(req);
        
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
                        return { name: tc.name, query, results };
                    }
                } else if (tc.name === "generate_image") {
                    const imgPrompt = tc.args.prompt || "image";
                    const imageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(imgPrompt)}?width=1024&height=1024&nologo=true`;
                    const md = `![${imgPrompt}](${imageUrl})`;
                    return { name: tc.name, query: imgPrompt, results: [{ content: md }] };
                }
                return { name: tc.name, query: null, results: [] };
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

                functionResponses.push({
                    functionResponse: {
                        name: resolved.name,
                        response: toolResultObj
                    }
                });
            }

            if (combinedSources.length > 0) {
                searchMetadata = { query: combinedQuery, sources: combinedSources };
                if (res && typeof res.write === "function") {
                    res.write(`data: ${JSON.stringify({ type: "search_completed", sources: combinedSources })}\n\n`);
                }
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

            const stream2 = await modelInstance.generateContentStream({ contents: newContents });
            
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
            res.write(`data: ${JSON.stringify({ error: "Failed to generate response." })}\n\n`);
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
