import { geminiChatStream, generateTitle } from './utils/gemini.js';

const runTest = async () => {
    console.log("=== SENDING NORMAL MESSAGE ===");
    const message1 = "Hi there! How are you?";
    console.log("Generated Title:", await generateTitle(message1));
    await geminiChatStream([{ role: "user", content: message1 }], "Default Assistant", "en", null);
    
    console.log("\n=== SENDING IMAGE MESSAGE ===");
    const message2 = "Generate a picture of a cute fluffy cat.";
    console.log("Generated Title:", await generateTitle(message2));
    await geminiChatStream([{ role: "user", content: message2 }], "Default Assistant", "en", null);

    console.log("\n=== TEST FINISHED ===");
};

runTest();
