import "dotenv/config";
import { geminiChatStream } from "./utils/gemini.js";

async function test() {
    console.log("Testing geminiChatStream natively...");
    try {
        const mockRes = {
            write: (data) => console.log("Stream write:", data)
        };
        
        const result = await geminiChatStream([{role: "user", content: "hello"}], "Default Assistant", "en", mockRes, "gemini-flash-latest");
        console.log("Result:", result);
    } catch (err) {
        console.error("Caught error:", err);
    }
}
test();
