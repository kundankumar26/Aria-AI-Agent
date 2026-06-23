import OpenAI from "openai";
import "dotenv/config";
import { logger } from "./logger.js";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function planResearch(topic, userProfile) {
    logger.info(`Planning research for: "${topic}"`);

    try {
        const response = await client.chat.completions.create({
            model: "gpt-4o",
            temperature: 0.2,
            max_tokens: 600,
            messages: [{
                role: "user",
                content: `You are an expert research planner.
        
                    The user wants to research: "${topic}"
                    User expertise level: ${userProfile.expertise}
                    User preferences: ${userProfile.preferences.join(", ")}

                    Create a research plan. Return ONLY valid JSON, no markdown:
                    {
                    "refined_topic": "more specific version of the topic",
                    "sub_questions": [
                        "specific question 1 the research should answer",
                        "specific question 2",
                        "specific question 3",
                        "specific question 4"
                    ],
                    "search_queries": [
                        "optimised search query 1 — use specific keywords",
                        "optimised search query 2 — different angle",
                        "optimised search query 3 — contrarian/limitations angle"
                    ],
                    "source_priorities": [
                        "type of source most credible for this topic",
                        "second priority source type"
                    ],
                    "context": "1-2 sentences of background context the agent should know before researching"
                    }`
            }]
        });

        const raw = response.choices[0].message.content.trim();
        const plan = JSON.parse(raw);

        logger.info(`Research plan created: ${plan.search_queries.length} queries planned`);
        return plan;

    } catch (err) {
        logger.warn(`Planning failed (${err.message}) — proceeding without plan`);
        return null;
    }
}