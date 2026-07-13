import "dotenv/config";
import { groqChatStream } from "./utils/openai.js";

const fakeRes = {
    write: (data) => console.log("SSE:", data)
};

async function run() {
    try {
        const history = [
            { role: "user", content: "send the current event happening in Jaipur today" }
        ];
        
        console.log("Starting chat stream...");
        const result = await groqChatStream(history, "Default Assistant", "en", fakeRes);
        console.log("Result:", result);
    } catch (err) {
        console.error("Test failed:", err);
    }
}

run();
