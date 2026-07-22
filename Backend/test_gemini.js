import "dotenv/config";
import { geminiChatStream } from "./utils/gemini.js";

const testMessages = [
    // 3 Should NOT trigger
    "kya kar rahe ho?",
    "how are you today?",
    "what's up?",
    
    // 3 Should trigger
    "generate an image of a cat in space",
    "create a picture of a futuristic city",
    "draw a flying car",
];

async function runTests() {
    console.log("Testing intent recognition and tool execution...");
    for (const msg of testMessages) {
        let responseTokens = "";
        
        const mockRes = {
            write: (data) => {
                try {
                    const parsed = JSON.parse(data.replace("data: ", ""));
                    if (parsed.token) responseTokens += parsed.token;
                } catch(e) {}
            }
        };

        const result = await geminiChatStream([{role: "user", content: msg}], "Default Assistant", "en", mockRes);
        const hasImage = result.fullReply.includes("![");
        console.log(`Msg: "${msg}" -> Generated Image? ${hasImage ? "YES" : "NO"}`);
        console.log("-----------------------------------------");
    }
}

runTests();
