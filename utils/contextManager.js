// utils/contextManager.js

import OpenAI from "openai";
import "dotenv/config";
import { logger } from "./logger.js";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Rough token estimate — 1 token ≈ 4 chars
function estimateTokens(messages) {
    return messages.reduce((sum, m) => {
        const content = typeof m.content === "string" ? m.content : "";
        return sum + Math.ceil(content.length / 4);
    }, 0);
}

export async function manageContextWindow(messages, maxTokens = 30000) {
    const estimated = estimateTokens(messages);

    // Under limit — no action needed
    if (estimated < maxTokens * 0.8) {
        return messages;
    }

    logger.info(`Context window at ${estimated} tokens — summarising old turns`);

    const systemMsg = messages[0];     // always keep system prompt
    const recentMsg = messages.slice(-6); // always keep last 6 messages
    const oldMsgs = messages.slice(1, -6); // middle section to summarise

    if (oldMsgs.length < 4) return messages;  // not enough to summarise

    // Summarise the old portion
    const summary = await summariseHistory(oldMsgs);

    // Replace old messages with a single summary message
    const summaryMessage = {
        role: "system",
        content: `[Earlier conversation summary — ${oldMsgs.length} messages compressed]
        ${summary}
        [End of summary — recent messages follow]`
    };

    const managed = [systemMsg, summaryMessage, ...recentMsg];

    logger.info(
        `Context reduced: ${estimated} → ${estimateTokens(managed)} tokens`
    );

    return managed;
}

async function summariseHistory(messages) {
    try {
        const transcript = messages
            .filter(m => m.role === "user" || m.role === "assistant")
            .map(m => `${m.role === "user" ? "User" : "Aria"}: ${String(m.content || "").slice(0, 500)
                }`)
            .join("\n\n");

        const response = await client.chat.completions.create({
            model: "gpt-4o-mini",
            temperature: 0.1,
            max_tokens: 400,
            messages: [{
                role: "user",
                content: `Summarise this conversation history concisely.
                  Capture: topics researched, key findings mentioned,
                  decisions made, and any user preferences expressed.
                  Keep it under 300 words.

                  Conversation:
                  ${transcript}`
            }]
        });

        return response.choices[0].message.content;

    } catch {
        // If summarisation fails — return a simple fallback
        return `[Earlier conversation with ${messages.length} messages — content compressed]`;
    }
}