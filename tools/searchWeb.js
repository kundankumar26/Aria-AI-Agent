import "dotenv/config";
import { getCached, setCached } from "../utils/cache.js";
import { logger } from "../utils/logger.js";

export const searchWebTool = {
    type: "function",
    function: {
        name: "search_web",
        description: `Search the internet AND retrieve full content from
                  top results in a single call. Use this instead of
                  read_url for standard research — it's faster.
                  Only use read_url for specific URLs not in search results.`,
        parameters: {
            type: "object",
            properties: {
                query: {
                    type: "string",
                    description: "Search query — specific keywords work best"
                },
                max_results: {
                    type: "number",
                    description: "Results to return (default 5, max 8)"
                },
                include_full_content: {
                    type: "boolean",
                    description: "Set true to get full article text (default true)"
                }
            },
            required: ["query"]
        }
    }
};

export async function search_web({ query, max_results = 2, include_full_content = true }) {

    // ── Check cache first ──────────────────────────────
    const cached = getCached(query);
    if (cached) {
        logger.info(`⚡ Cache hit — skipping API call for "${query}"`);
        return cached + "\n\n[Note: Results cached from earlier today]";
    }

    const result = await fetchFromTavily(query, max_results, include_full_content);

    await setCached(query, result);

    return result;
}

async function fetchFromTavily(query, max_results, include_full_content) {
    const response = await fetch("https://api.tavily.com/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            api_key: process.env.TAVILY_API_KEY,
            query,
            max_results: Math.min(max_results, 5),
            search_depth: "advanced",
            include_raw_content: include_full_content,
            include_answer: true,
            include_images: false
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
        .filter(r => r.score > 0.4)
        .slice(0, max_results);

    // Build rich result with full content included
    const formatted = filtered.map((r, i) => {
        const content = include_full_content
            ? (r.raw_content || r.content || "").slice(0, 2000)
            : r.content?.slice(0, 300) || "";

        return `[${i + 1}] ${r.title}
            URL: ${r.url}
            Published: ${r.published_date || "Unknown"}
            Relevance: ${Math.round(r.score * 100)}%

            ${content}`;
    }).join("\n\n═══════════════════════════════\n\n");

    // Include Tavily's own answer if available (bonus context)
    const tavilyAnswer = data.answer
        ? `TAVILY SUMMARY: ${data.answer}\n\n═══════════════════════════════\n\n`
        : "";

    return tavilyAnswer + formatted;
}