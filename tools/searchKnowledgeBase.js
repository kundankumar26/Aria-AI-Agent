import { searchVectorStore } from "../utils/vectorStore.js";

export const searchKnowledgeBaseTool = {
    type: "function",
    function: {
        name: "search_knowledge_base",
        description: `Semantically search your personal knowledge base of past research notes. ALWAYS call this before searching the web.`,
        parameters: {
            type: "object",
            properties: {
                query: {
                    type: "string",
                    description: "What to search for in your research notes"
                },
                top_results: {
                    type: "number",
                    description: "Number of top results to return (default 5)"
                }
            },
            required: ["query"]
        }
    }
};

export async function search_knowledge_base({ query, top_results = 5 }) {
    const results = await searchVectorStore(query, top_results);

    if (results.length === 0) {
        return "No relevant research found in knowledge base.";
    }

    return results
        .filter(r => r.score >= 0.3) // filter out low-relevance results
        .map((r, i) =>
            `[${i + 1}] Source: ${r.source ?? "Unknown"} | Match: ${Math.round(r.score * 100)}%\n${r.content ?? ""}`
        )
        .join("\n\n---\n\n") || "No relevant research found in knowledge base.";
}