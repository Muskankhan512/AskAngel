import "dotenv/config";
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function testImage() {
    console.log("Testing image API natively...");
    try {
        const modelInstance = genAI.getGenerativeModel({ 
            model: "gemini-flash-latest",
            tools: [{
                functionDeclarations: [{
                    name: "generate_image",
                    description: "Generate an image",
                    parameters: { type: "OBJECT", properties: { prompt: { type: "STRING" } }, required: ["prompt"] }
                }]
            }]
        });

        const req = { contents: [{ role: "user", parts: [{ text: "image generate kar do ek ladki ki" }] }] };
        let streamResult = await modelInstance.generateContent(req);
        
        const modelMessage = streamResult.response.candidates[0].content;
        console.log("modelMessage:", JSON.stringify(modelMessage, null, 2));

        const functionResponses = [{
            functionResponse: {
                name: "generate_image",
                response: {
                    status: "SUCCESS",
                    message: "The image has been generated.",
                    markdown_to_display: "![image](url)"
                }
            }
        }];

        const newContents = [
            req.contents[0],
            modelMessage,
            { role: "user", parts: functionResponses }
        ];
        
        console.log("newContents:", JSON.stringify(newContents, null, 2));

        const stream2 = await modelInstance.generateContentStream({ contents: newContents });
        console.log("stream2 initialized successfully!");
    } catch (e) {
        console.error("Test failed:", e);
    }
}
testImage();
