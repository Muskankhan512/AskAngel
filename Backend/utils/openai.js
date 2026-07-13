import "dotenv/config";
import OpenAI from "openai";

const openai = new OpenAI({
    apiKey: process.env.GROQ_API_KEY,
    baseURL: "https://api.groq.com/openai/v1"
});

const tools = [
    {
        type: "function",
        function: {
            name: "web_search",
            description: "Search the web for current events, news, or real-time information that you don't know.",
            parameters: {
                type: "object",
                properties: {
                    query: {
                        type: "string",
                        description: "The exact search query to look up on the web."
                    }
                },
                required: ["query"]
            }
        }
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

export const groqChatStream = async (messageHistory, persona, language, res, model = "llama-3.3-70b-versatile") => {
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
    const systemPrompt = `${targetPersona}\nAlways respond in ${targetLang}, regardless of what language the user writes in.\nIMPORTANT INSTRUCTION FOR TOOL USAGE: ONLY use the web_search tool if the user explicitly asks a question requiring real-time information or facts you do not know. DO NOT use the web_search tool for casual conversational messages, greetings like "hello", "hi", or generic statements.`;

    const formattedMessages = [
        { role: "system", content: systemPrompt },
        ...messageHistory.map(m => ({
            role: m.role,
            content: m.content
        }))
    ];

    let fullReply = "";
    let searchMetadata = null; // To store { query, sources }

    let streamResult;
    let toolCallsList = [];
    
    try {
        // 1. Initial Request (non-streaming for reliable tool-call parsing)
        streamResult = await openai.chat.completions.create({
            model: model,
            messages: formattedMessages,
            tools: tools,
            parallel_tool_calls: true,
            stream: false
        });
        
        const initialMessage = streamResult.choices[0]?.message;
        toolCallsList = initialMessage?.tool_calls || [];
        
    } catch (err) {
        // Fallback: If Groq's internal parser fails to parse the model's raw output, it throws a 400 error
        // but gives us the raw output in 'failed_generation'. We can parse it manually!
        const failedGen = err.error?.failed_generation || err.failed_generation;
        if (failedGen) {
            const match = failedGen.match(/<function=([^>\{\s]+)[\s=]*(\{.*)/);
            if (match) {
                const funcName = match[1];
                let funcArgs = match[2].replace(/<\/function>[\s\S]*$/, '').trim();
                
                toolCallsList = [{
                    id: "call_" + Math.random().toString(36).substring(7),
                    type: "function",
                    function: {
                        name: funcName,
                        arguments: funcArgs
                    }
                }];
            } else {
                console.error("Could not regex parse failed_generation:", failedGen);
                throw err;
            }
        } else {
            console.error("Error creating initial Groq stream:", err);
            throw err;
        }
    }

    if (toolCallsList.length === 0) {
        // No tools called, simulate streaming the final text
        const initialMessage = streamResult?.choices[0]?.message;
        if (initialMessage?.content) {
            fullReply = initialMessage.content;
            const words = fullReply.match(/(\s+|\S+)/g) || [];
            for (const word of words) {
                res.write(`data: ${JSON.stringify({ token: word })}\n\n`);
                await new Promise(resolve => setTimeout(resolve, 15)); // 15ms delay per word
            }
        }
    } else {
        // Tools were called!
        try {
            let combinedResultsText = "";
            let combinedSources = [];
            let combinedQuery = "";

            // Append assistant tool call requests to history
            formattedMessages.push({
                role: "assistant",
                content: null,
                tool_calls: toolCallsList
            });

            // Execute all tool calls concurrently
            const toolExecutions = toolCallsList.map(async (tc) => {
                if (tc.function.name === "web_search") {
                    let args = {};
                    try {
                        args = JSON.parse(tc.function.arguments || "{}");
                    } catch (parseErr) {
                        console.error("JSON parse error for tool arguments:", tc.function.arguments);
                    }
                    
                    const query = args.query;
                    
                    if (query) {
                        res.write(`data: ${JSON.stringify({ type: "search_started", query })}\n\n`);
                        const results = await executeWebSearch(query);
                        return { id: tc.id, query, results };
                    }
                }
                return { id: tc.id, query: null, results: [] };
            });

            const resolvedTools = await Promise.all(toolExecutions);

            for (const resolved of resolvedTools) {
                const results = resolved.results;
                if (resolved.query) combinedQuery += (combinedQuery ? ", " : "") + resolved.query;
                combinedSources.push(...results);

                const toolResultText = results.length > 0 
                    ? results.map(r => `Title: ${r.title}\nURL: ${r.url}\nContent: ${r.content}`).join('\n\n')
                    : "No relevant information found.";

                combinedResultsText += toolResultText + "\n\n";

                formattedMessages.push({
                    role: "tool",
                    tool_call_id: resolved.id,
                    content: toolResultText
                });
            }

            searchMetadata = { query: combinedQuery, sources: combinedSources };
            res.write(`data: ${JSON.stringify({ type: "search_completed", sources: combinedSources })}\n\n`);

            // Start 2nd Stream
            const stream2 = await openai.chat.completions.create({
                model: model,
                messages: formattedMessages,
                stream: true
            });

            for await (const chunk of stream2) {
                const delta = chunk.choices[0]?.delta;
                if (delta?.content) {
                    fullReply += delta.content;
                    res.write(`data: ${JSON.stringify({ token: delta.content })}\n\n`);
                }
            }
        } catch (e) {
            console.error("Tool execution failed:", e);
            res.write(`data: ${JSON.stringify({ error: "Failed to perform web search." })}\n\n`);
        }
    }

    return { fullReply, searchMetadata };
};

export const generateTitle = async (message) => {
    try {
        const response = await openai.chat.completions.create({
            model: "llama-3.1-8b-instant",
            messages: [
                { role: "system", content: "You are a title generator. Generate a very short, smart title (3 to 6 words maximum) summarizing the user's prompt. Do not use quotes around the title. Do not provide any conversational text or formatting." },
                { role: "user", content: message }
            ],
            max_tokens: 15
        });
        let generated = response.choices[0]?.message?.content?.trim() || "";
        // Remove surrounding quotes if model added them
        generated = generated.replace(/^["'](.*)["']$/, '$1');
        return generated || message.slice(0, 60);
    } catch (err) {
        console.error("Failed to generate title:", err);
        return message.slice(0, 60); // fallback
    }
};