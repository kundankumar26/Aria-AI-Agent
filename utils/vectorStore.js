import fs from "fs/promises";
import { getEmbedding, getEmbeddingsBatch, cosineSimilarity } from "./embeddings.js";
import { chunkDocument } from "./chunker.js";

const STORE_PATH = "vector-store.json";

let vectors = [];  // in-memory store

// Build the store from scratch from a set of documents
export async function buildVectorStore(documents) {
    console.log(`📦 Building vector store from ${documents.length} docs...`);
    vectors = [];

    for (const doc of documents) {
        const chunks = chunkDocument(doc);
        const contents = chunks.map(chunk => chunk.content);
        // Batch embed all chunks for this doc
        const embeddings = await getEmbeddingsBatch(contents);
        for (let i = 0; i < chunks.length; i++) {
            vectors.push({ ...chunks[i], embedding: embeddings[i] });
        }
    }

    await fs.writeFile(STORE_PATH, JSON.stringify(vectors));
    console.log(`✅ Vector store built: ${vectors.length} chunks`);
}

// Load existing store from disk
export async function loadVectorStore() {
    try {
        const data = await fs.readFile(STORE_PATH, "utf-8");
        vectors = JSON.parse(data);
        console.log(`✅ Vector store loaded: ${vectors.length} chunks`);
    } catch {
        vectors = [];  // no store yet — start fresh
    }
}

// Add new chunks from a single document
export async function addToVectorStore(doc) {
    const chunks = chunkDocument(doc);
    const contents = chunks.map(chunk => chunk.content);
    const embeddings = await getEmbeddingsBatch(contents);

    for (let i = 0; i < chunks.length; i++) {
        vectors.push({ ...chunks[i], embedding: embeddings[i] });
    }

    await fs.writeFile(STORE_PATH, JSON.stringify(vectors));
}

// Search for chunks most similar to a query
export async function searchVectorStore(query, topK = 5) {
    if (vectors.length === 0) return [];

    const queryVec = await getEmbedding(query);

    return vectors
        .map(v => ({
            content: v.content,
            source: v.source,
            score: Math.round(cosineSimilarity(queryVec, v.embedding) * 100)
        }))
        .filter(v => v.score > 50)       // ignore low relevance
        .sort((a, b) => b.score - a.score)
        .slice(0, topK);
}