import OpenAI from "openai";
import "dotenv/config";
import { withRetry } from "./retry.js";
import { withTimeout } from "./timeout.js";
import { trimMessages } from "./messageTrimmer.js";
import { logger } from "./logger.js";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function runAgentLoop(messages, toolDefs, toolFns) {
    let iterations = 0;
    let totalTokens = 0;
    let recentCalls = [];
    let toolCallLog = [];
    const LIMITS = {
        maxIterations: 30,
        maxTokens: 1000000,
        maxMessages: 50,
        maxResultChars: 2000,
        timeoutMs: 900000
    };

    while (true) {
        logger.step(iterations, "Calling LLM...");

        // ── Safety: iteration + token limits ────────────────
        iterations++;
        if (iterations > LIMITS.maxIterations) {
            return {
                toolCalls: toolCallLog,
                content: "⚠️ Reached max steps. Try a more specific question."
            };
        }
        if (totalTokens > LIMITS.maxTokens) {
            // Collect all assistant and tool message contents
            const collected = messages
                .filter(m => (m.role === "assistant" || m.role === "tool") && m.content)
                .map(m => m.content)
                .join("\n\n");

            // Use the LLM to summarize the collected content
            let summary = "";
            try {
                const summaryResponse = await client.chat.completions.create({
                    model: "gpt-5-nano",
                    messages: [
                        { role: "system", content: "Summarize the following results for the user in a clear and concise way." },
                        { role: "user", content: collected.slice(0, 12000) } // limit to 12k chars for context
                    ],
                    temperature: 1
                });
                summary = summaryResponse.choices[0].message.content;
            } catch (err) {
                summary = "(Could not generate summary. Here are the raw results:)\n\n" + collected;
            }

            return {
                toolCalls: toolCallLog,
                content: `⚠️ Reached processing budget. Here's a summary of what I found so far.\n\n${summary}`
            };
        }

        // ── Trim messages ───────────────────────────────────
        const trimmed = trimMessages(messages, LIMITS.maxMessages);

        // ── Call LLM ────────────────────────────────────────
        let response;
        try {
            response = await withRetry(
                () => withTimeout(
                    () => client.chat.completions.create({
                        model: "gpt-5-nano",
                        messages: trimmed,
                        tools: toolDefs.length > 0 ? toolDefs : undefined,
                        temperature: 1
                    }),
                    LIMITS.timeoutMs
                ),
                { maxAttempts: 3, delayMs: 3000 }
            );
        } catch (err) {
            return `❌ LLM error: ${err.message}. Please try again.`;
        }

        totalTokens += response.usage?.total_tokens || 0;

        const choice = response.choices[0];
        const message = choice.message;

        logger.step(iterations, `finish_reason: ${choice.finish_reason}`);

        // ── Done ────────────────────────────────────────────
        if (choice.finish_reason === "stop") {
            return {
                toolCalls: toolCallLog,
                content: message.content
            };
        }

        // ── Tool calls ──────────────────────────────────────
        if (choice.finish_reason === "tool_calls") {
            messages.push(message);

            // Classify tool calls synchronously first (preserves recentCalls order)
            const tasks = message.tool_calls.map(toolCall => {
                const fnName = toolCall.function.name;
                let fnArgs;
                try {
                    fnArgs = JSON.parse(toolCall.function.arguments);
                } catch {
                    return { toolCall, skip: "Error: Invalid arguments. Please retry the tool call." };
                }

                if (!toolFns[fnName]) {
                    return { toolCall, skip: `Unknown tool "${fnName}".` };
                }

                const sig = `${fnName}:${JSON.stringify(fnArgs)}`;
                const dupCount = recentCalls.filter(c => c === sig).length;
                recentCalls = [...recentCalls.slice(-9), sig];

                if (dupCount >= 2) {
                    return { toolCall, skip: `You've called ${fnName} with these args ${dupCount + 1}x. Use existing results and move forward.` };
                }

                return { toolCall, fnName, fnArgs };
            });

            // Execute all runnable tasks in parallel
            const results = await Promise.allSettled(tasks.map(async task => {
                if (task.skip) return { ...task, content: task.skip };

                const { toolCall, fnName, fnArgs } = task;

                const start = Date.now();
                let content, durationMs;
                try {
                    const result = await withRetry(
                        () => withTimeout(() => toolFns[fnName](fnArgs), LIMITS.timeoutMs),
                        { maxAttempts: 2, delayMs: 500 }
                    );
                    durationMs = Date.now() - start;
                    content = String(result).slice(0, LIMITS.maxResultChars);
                } catch (err) {
                    durationMs = Date.now() - start;
                    const msg = err?.message ?? String(err);
                    content = msg.includes('404') || msg.toLowerCase().includes('not found')
                        ? `Tool "${fnName}" failed: Resource not found (404). Skipping this source.`
                        : `Tool "${fnName}" failed: ${msg}. Try a different approach.`;

                }

                logger.tool(fnName, fnArgs, content);

                return { toolCall, fnName, fnArgs, content, durationMs };
            }));

            // Push all results to messages in order
            for (const r of results) {
                if (!r.skip) {
                    toolCallLog.push({ name: r.fnName, args: r.fnArgs, durationMs: r.durationMs, output: r.content });
                }
                messages.push({ role: "tool", tool_call_id: r.toolCall.id, content: r.content });
            }
        }
    }
}