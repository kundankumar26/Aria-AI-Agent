// utils/reviewer.js

import OpenAI from "openai";
import "dotenv/config";
import { logger } from "./logger.js";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function reviewResponse(response, originalQuery, userProfile) {
    logger.info("Running self-review...");

    try {
        const review = await client.chat.completions.create({
            model: "gpt-4o-mini",   // cheaper model for review
            temperature: 0.1,
            max_tokens: 500,
            messages: [{
                role: "user",
                content: `You are a quality reviewer for research reports.

                    Original query: "${originalQuery}"
                    User expertise: ${userProfile.expertise}

                    Review this research report and return JSON only. Do not include markdown, code blocks, or any extra text. The JSON should have this format:
                    {
                        "word_count": number,
                        "has_specific_data": true/false,
                        "has_citations": true/false,
                        "answers_query": true/false,
                        "quality_score": 1-10,
                        "issues": ["issue 1 if any", "issue 2 if any"],
                        "verdict": "publish" or "needs_improvement",
                        "improvement_note": "one sentence on what's missing, or null if none"
                    }

                    Report to review:
                    ${response.slice(0, 3000)}`
            }]
        });

        return JSON.parse(review.choices[0].message.content);

    } catch {
        return null;  // review failed — return original response anyway
    }
}