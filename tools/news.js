// tools/news.js

export const newsTool = {
    type: "function",
    function: {
        name: "get_news",
        description: `Get top news headlines on any topic or from any country.
                  Use for morning briefings, staying current on a topic,
                  or when user asks "what's happening with X".`,
        parameters: {
            type: "object",
            properties: {
                topic: {
                    type: "string",
                    description: "Topic to search news for e.g. 'AI', 'India economy', 'cricket'"
                },
                country: {
                    type: "string",
                    description: "Country code for top headlines: 'in' (India), 'us', 'gb', etc."
                },
                max_articles: {
                    type: "number",
                    description: "Number of articles to return (default 5, max 10)"
                }
            }
        }
    }
};

export async function get_news({ topic, country = "in", max_articles = 5 }) {
    const KEY = process.env.NEWS_API_KEY;
    let url;

    if (topic) {
        // Search by topic
        url = `https://newsapi.org/v2/everything?` +
            `q=${encodeURIComponent(topic)}` +
            `&sortBy=publishedAt` +
            `&pageSize=${Math.min(max_articles, 10)}` +
            `&language=en` +
            `&apiKey=${KEY}`;
    } else {
        // Top headlines by country
        url = `https://newsapi.org/v2/top-headlines?` +
            `country=${country}` +
            `&pageSize=${Math.min(max_articles, 10)}` +
            `&apiKey=${KEY}`;
    }

    const response = await fetch(url);
    if (!response.ok) throw new Error(`News API error: ${response.status}`);

    const data = await response.json();
    const articles = data.articles?.filter(a => a.title !== "[Removed]") || [];

    if (!articles.length) {
        return `No news found for "${topic || "top headlines"}".`;
    }

    return articles.slice(0, max_articles).map((a, i) => {
        const date = new Date(a.publishedAt)
            .toLocaleDateString("en-IN", {
                day: "numeric", month: "short", hour: "2-digit", minute: "2-digit"
            });
        return `[${i + 1}] ${a.title}
    Source: ${a.source.name} | ${date}
    ${a.description || ""}
    URL: ${a.url}`;
    }).join("\n\n");
}