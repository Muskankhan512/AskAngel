import "dotenv/config";
import { geminiChatStream } from "./utils/gemini.js";

async function testChat() {
    console.log("Testing text generation with gemini-flash-lite-latest...");
    try {
        const mockRes = {
            write: (data) => console.log("Stream write:", data)
        };
        const result = await geminiChatStream([{role: "user", content: "suno"}], "Default Assistant", "en", mockRes, "gemini-flash-lite-latest");
        console.log("Result:", result);
    } catch (e) {
        console.error("Test failed:", e.message);
    }
}
testChat();
