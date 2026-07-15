import { groqChatStream } from './utils/openai.js';

const mockRes = {
    write: (data) => console.log("RES.WRITE:", data),
    end: () => console.log("RES.END")
};

const messages = [
    { role: "user", content: "generate an image of a red sports car" }
];

async function test() {
    try {
        console.log("Starting test...");
        const result = await groqChatStream(messages, "Default Assistant", "en", mockRes);
        console.log("RESULT:", result);
    } catch (e) {
        console.error("TEST FAILED:", e);
    }
}

test();
