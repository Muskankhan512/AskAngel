import "dotenv/config";

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODEL = "openai/gpt-oss-20b";

const languageNames = {
    en: "English",
    hi: "natural Hindi",
    pa: "Punjabi",
    ur: "Urdu",
    mr: "Marathi",
    bn: "Bengali"
};

const personaPrompts = {
    "Default Assistant": "You are a helpful, respectful, and honest AI assistant.",
    "Coding Assistant": "You are an expert programmer. Give clear explanations and working code examples.",
    "Friendly Tutor": "You are a patient tutor who explains concepts simply with examples.",
    "Motivational Coach": "You are an energetic motivational coach who gives encouraging, actionable advice.",
    "Doctor Advisor": "You provide general health information and remind users to consult a qualified doctor for diagnosis or treatment."
};

const systemPromptFor = (persona, language) => {
    const languageInstruction = languageNames[language]
        ? `Respond primarily in ${languageNames[language]}, while respecting explicit language requests.`
        : "Match the language and style of the user's prompt.";
    return `${personaPrompts[persona] || personaPrompts["Default Assistant"]}\n${languageInstruction}\nUse concise markdown formatting.`;
};

export const groqChat = async (messageHistory, persona, language, res) => {
    if (!process.env.GROQ_API_KEY) {
        throw new Error("GROQ_API_KEY is not configured");
    }

    const messages = [
        { role: "system", content: systemPromptFor(persona, language) },
        ...messageHistory.map(message => ({
            role: message.role === "assistant" ? "assistant" : "user",
            content: message.content || ""
        }))
    ];

    const response = await fetch(GROQ_URL, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${process.env.GROQ_API_KEY}`
        },
        body: JSON.stringify({
            model: GROQ_MODEL,
            messages,
            temperature: 0.7
        })
    });

    const data = await response.json();
    if (!response.ok) {
        throw new Error(data?.error?.message || `Groq request failed with status ${response.status}`);
    }

    const fullReply = data.choices?.[0]?.message?.content?.trim();
    if (!fullReply) throw new Error("Groq returned an empty response");

    if (res && typeof res.write === "function") {
        res.write(`data: ${JSON.stringify({ token: fullReply })}\n\n`);
    }

    return { fullReply, searchMetadata: null };
};
