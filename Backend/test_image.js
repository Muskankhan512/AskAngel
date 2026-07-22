import "dotenv/config";
import { geminiChatStream } from "./utils/gemini.js";

async function testImage() {
    console.log("Testing image generation...");
    try {
        const mockRes = {
            write: (data) => console.log("Stream write:", data)
        };
        const result = await geminiChatStream([{role: "user", content: "image generate kar do ek ladki ki"}], "Default Assistant", "en", mockRes, "gemini-flash-latest");
        console.log("Result:", result);
    } catch (e) {
        console.error("Test failed:", e.toString());
    }
}
testImage();
