import OpenAI from "openai";
import "dotenv/config";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Convert text into a vector of numbers representing its meaning
export async function getEmbedding(text) {
    const response = await client.embeddings.create({
        model: "text-embedding-3-small",
        input: text.slice(0, 8000)  // max input length
    });
    return response.data[0].embedding;
}

// Batch embed multiple texts
export async function getEmbeddingsBatch(texts) {
    // Truncate each text to 8000 chars (OpenAI model limit)
    const inputs = texts.map(t => t.slice(0, 8000));
    const response = await client.embeddings.create({
        model: "text-embedding-3-small",
        input: inputs
    });
    return response.data.map(d => d.embedding);
}

// Measure how similar two vectors are (0 = different, 1 = identical)
export function cosineSimilarity(vecA, vecB) {
    const dot = vecA.reduce((sum, a, i) => sum + a * vecB[i], 0);
    const magA = Math.sqrt(vecA.reduce((sum, a) => sum + a * a, 0));
    const magB = Math.sqrt(vecB.reduce((sum, b) => sum + b * b, 0));
    return dot / (magA * magB);
}