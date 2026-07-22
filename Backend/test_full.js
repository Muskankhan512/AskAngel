import "dotenv/config";

async function testBackend() {
    console.log("Testing backend...");
    try {
        const authRes = await fetch("http://localhost:8080/api/auth/register", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: "Test User 2", email: "test2@example.com", password: "password123" })
        });
        
        const data = await authRes.json();
        console.log("Register data:", data);
        if (!data.token) return;

        const response = await fetch("http://localhost:8080/api/chat", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${data.token}`
            },
            body: JSON.stringify({
                threadId: "test-thread-12345",
                message: "image generate kar do ek ladki ki",
                language: "hi",
                model: "gemini-flash-latest"
            })
        });

        console.log("Response status:", response.status);
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            console.log("CHUNK:", decoder.decode(value, { stream: true }));
        }
    } catch (err) {
        console.error("Test failed:", err);
    }
}
testBackend();
