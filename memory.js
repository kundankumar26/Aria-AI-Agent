import fs from "fs/promises";
import {
    loadVectorStore,
    searchVectorStore
} from "./utils/vectorStore.js";

// Load user preferences from disk
export async function loadUserProfile() {
    try {
        const data = await fs.readFile("user_profile.json", "utf-8");
        return JSON.parse(data);
    } catch {
        // Default profile if file missing
        return {
            name: "User",
            expertise: "General",
            preferences: ["Cite sources", "Be concise"]
        };
    }
}

// Find past research related to the current topic
export async function findRelatedNotes(topic) {
    await loadVectorStore();

    const results = await searchVectorStore(topic, 3);

    if (results.length === 0) return null;

    return results
        .map(r => `From "${r.source}" (${r.score}% match):\n${r.content}`)
        .join("\n\n---\n\n");
}