// tools/briefing.js

// Import needed tools for briefing
import { get_weather } from "./weather.js";
import { get_news } from "./news.js";

export const morningBriefingTool = {
    type: "function",
    function: {
        name: "get_morning_briefing",
        description: `Generate a personalised morning briefing combining
                  today's calendar, local weather, top news. Use when user asks for "briefing",
                  "morning update", "what's happening today", or
                  "catch me up".`,
        parameters: {
            type: "object",
            properties: {
                city: {
                    type: "string",
                    description: "User's city for weather"
                },
                news_topics: {
                    type: "array",
                    items: { type: "string" },
                    description: "Topics to get news on e.g. ['technology', 'India']"
                }
            }
        }
    }
};

export async function get_morning_briefing({ city = "Mumbai", news_topics = ["technology", "India"] }) {

    // Run all data fetches in parallel
    const [weather, newsResults] = await Promise.allSettled([
        get_weather({ city }),
        ...news_topics.map(topic => get_news({ topic, max_articles: 2 }))
    ]);

    const safeGet = settled =>
        settled.status === "fulfilled" ? settled.value : "Unavailable";

    const newsContent = newsResults
        .map((r, i) => `### ${news_topics[i]}\n${safeGet(r)}`)
        .join("\n\n");

    const now = new Date().toLocaleString("en-IN", {
        weekday: "long", day: "numeric", month: "long",
        hour: "2-digit", minute: "2-digit"
    });

    return `# 🌅 Morning Briefing
        ${now}

        ---

        ## 🌤️ Weather — ${city}
        ${safeGet(weather)}

        ---

        ## 📰 News
        ${newsContent}`;
}
