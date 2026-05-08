import "dotenv/config";

export const searchWebTool = {
    type: "function",
    function: {
        name: "search_web",
        description: "Search the internet for current, up-to-date information. Only use this when the knowledge base has no relevant results. Prefer specific, keyword-rich queries for better results.",
        parameters: {
            type: "object",
            properties: {
                query: {
                    type: "string",
                    description: "Search query — use specific keywords, avoid vague or broad terms"
                },
                max_results: {
                    type: "number",
                    description: "Number of results to return (default 2, max 5)"
                }
            },
            required: ["query"]
        }
    }
};

export async function search_web({ query, max_results = 2 }) {
    const response = await fetch("https://api.tavily.com/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            api_key: process.env.TAVILY_API_KEY,
            query,
            max_results: Math.min(max_results, 5),
            search_depth: "advanced",
            include_raw_content: true,
            include_answer: true
        })
    });

    if (!response.ok) {
        throw new Error(`Search API error: ${response.status}`);
    }

    const data = await response.json();

    if (!data.results?.length) {
        return `No results found for "${query}". Try broader search terms.`;
    }

    // Filter low-quality results
    const filtered = data.results
        .filter(r => r.score > 0.5 && r.content?.length > 100)
        .slice(0, max_results);

    if (filtered.length === 0) {
        return `No high-quality results found for "${query}". Try different search terms.`;
    }

    return filtered.map((r, i) =>
        `[${i + 1}] ${r.title}
     URL: ${r.url}
     Relevance: ${Math.round(r.score * 100)}%
     Content: ${r.content.slice(0, 2000)}...`
    ).join("\n\n");
}