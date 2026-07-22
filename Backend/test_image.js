import "dotenv/config";
import { geminiChatStream } from "./utils/gemini.js";

async function testImage() {
    console.log("Testing image generation with gemini-1.5-flash-8b...");
    try {
        const mockRes = {
            write: (data) => console.log("Stream write:", data)
        };
        const result = await geminiChatStream([{role: "user", content: "image generate kar do ek ladki ki"}], "Default Assistant", "en", mockRes, "gemini-1.5-flash-8b");
        console.log("Result:", result);
    } catch (e) {
        console.error("Test failed:", e.message);
    }
}
testImage();
