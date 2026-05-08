import express from "express";
import { fileURLToPath } from "url";
import path from "path";
import "dotenv/config";
import { runAgent } from "./agent.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// API endpoint to handle research queries
app.post("/api/ask", async (req, res) => {
    const { question } = req.body;

    if (!question || !question.trim()) {
        return res.status(400).json({ error: "Please provide a question." });
    }

    try {
        const answer = await runAgent(question.trim());
        res.json({ ...answer });
    } catch (err) {
        console.error("Agent error:", err);
        res.status(500).json({ error: "Something went wrong. Please try again." });
    }
});

app.listen(PORT, () => {
    console.log(`\n🔬 Aria Research Assistant is running at http://localhost:${PORT}\n`);
});
