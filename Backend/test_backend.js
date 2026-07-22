import fetch from "node-fetch";

async function testBackend() {
    console.log("Testing backend route...");
    try {
        const response = await fetch("http://localhost:8080/api/chat", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                threadId: "test-thread-123",
                message: "image generate kar do ek ladki ki",
                language: "hi",
                model: "gemini-flash-latest"
            })
        });

        console.log("Response status:", response.status);
        console.log("Headers:", response.headers.raw());

        const reader = response.body;
        reader.on("data", (chunk) => {
            console.log("CHUNK:", chunk.toString());
        });
        reader.on("end", () => {
            console.log("Stream ended.");
        });
        reader.on("error", (err) => {
            console.error("Stream error:", err);
        });

    } catch (err) {
        console.error("Fetch error:", err);
    }
}

testBackend();
