// utils/streamingAgentLoop.js

import OpenAI from "openai";
import "dotenv/config";
import { withRetry } from "./retry.js";
import { withTimeout } from "./timeout.js";
import { trimMessages } from "./messageTrimmer.js";
import { logger } from "./logger.js";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function runStreamingAgentLoop(
    messages,
    toolDefs,
    toolFns,
    callbacks = {}
) {
    // ── Callbacks let caller react to events ────────────
    const {
        onToolCall = (name, args) => { },   // tool starting
        onToolResult = (name, result) => { }, // tool finished
        onToken = (token) => { },        // final answer token
        onDone = (fullText) => { },     // complete response
        onError = (err) => { }           // any error
    } = callbacks;

    let iterations = 0;
    let totalTokens = 0;
    let recentCalls = [];

    const LIMITS = {
        maxIterations: 30,
        maxTokens: 200000,
        maxMessages: 25,
        maxResultChars: 2000,
        timeoutMs: 900000
    };

    logger.step(iterations, "Calling LLM...");

    while (true) {
        iterations++;

        if (iterations > LIMITS.maxIterations) {
            const msg = "⚠️ Reached max steps. Try a more specific question.";
            onToken(msg);
            onDone(msg);
            return msg;
        }

        const trimmed = trimMessages(messages, LIMITS.maxMessages);

        // ── Decide: stream or not? ───────────────────────
        // We don't know if this will be a tool call or final answer yet.
        // Solution: try streaming, detect tool calls in stream.

        let response;
        try {
            response = await withRetry(
                () => withTimeout(
                    () => client.chat.completions.create({
                        model: "gpt-4o-mini",
                        messages: trimmed,
                        tools: toolDefs.length > 0 ? toolDefs : undefined,
                        temperature: 0.1,
                        stream: true    // ← always stream
                    }),
                    LIMITS.timeoutMs
                ),
                { maxAttempts: 3, delayMs: 2000 }
            );
        } catch (err) {
            const msg = `❌ LLM error: ${err.message}`;
            onError(err);
            return msg;
        }

        // ── Collect stream ───────────────────────────────
        let fullContent = "";
        let toolCallsData = [];
        let finishReason = null;
        let isStreamingText = false;

        for await (const chunk of response) {
            const choice = chunk.choices[0];
            if (!choice) continue;

            finishReason = choice.finish_reason || finishReason;
            const delta = choice.delta;

            // ── Text token — stream it live ────────────────
            if (delta?.content) {
                if (!isStreamingText) {
                    isStreamingText = true;
                    // Signal that final answer is starting
                    onToken("\n");
                }
                fullContent += delta.content;
                onToken(delta.content);  // ← fires for every word/token
            }

            // ── Tool call chunk — accumulate (can't stream these) ──
            if (delta?.tool_calls) {
                for (const tcDelta of delta.tool_calls) {
                    const idx = tcDelta.index;

                    // Initialise this tool call slot if needed
                    if (!toolCallsData[idx]) {
                        toolCallsData[idx] = {
                            id: "",
                            type: "function",
                            function: { name: "", arguments: "" }
                        };
                    }

                    // Accumulate the chunks
                    if (tcDelta.id) toolCallsData[idx].id += tcDelta.id;
                    if (tcDelta.function?.name) toolCallsData[idx].function.name += tcDelta.function.name;
                    if (tcDelta.function?.arguments) toolCallsData[idx].function.arguments += tcDelta.function.arguments;
                }
            }
        }

        // ── Handle finished stream ───────────────────────
        logger.step(iterations, `finish_reason: ${finishReason}`);

        // Case A: Final text answer — we already streamed it
        if (finishReason === "stop") {
            onDone(fullContent);
            return fullContent;
        }

        // Case B: Tool calls — run them now
        if (finishReason === "tool_calls" && toolCallsData.length > 0) {

            // Add assistant message with tool calls
            messages.push({
                role: "assistant",
                content: null,
                tool_calls: toolCallsData.map(tc => ({
                    id: tc.id,
                    type: "function",
                    function: {
                        name: tc.function.name,
                        arguments: tc.function.arguments
                    }
                }))
            });

            // Run all tool calls in parallel
            const toolResults = await Promise.allSettled(
                toolCallsData.map(async (tc) => {
                    const fnName = tc.function.name;

                    let fnArgs;
                    try {
                        fnArgs = JSON.parse(tc.function.arguments);
                    } catch {
                        return { tc, content: "Error: Invalid arguments." };
                    }

                    // Stuck loop detection
                    const sig = `${fnName}:${JSON.stringify(fnArgs)}`;
                    const dupCount = recentCalls.filter(c => c === sig).length;
                    recentCalls = [...recentCalls.slice(-15), sig];

                    if (dupCount >= 2) {
                        return {
                            tc,
                            content: `Already called ${fnName} with these args. Move forward.`
                        };
                    }

                    // Notify caller — tool is starting
                    onToolCall(fnName, fnArgs);

                    const start = Date.now();
                    let content, durationMs;
                    try {
                        const result = await withRetry(
                            () => withTimeout(() => toolFns[fnName](fnArgs), LIMITS.timeoutMs),
                            { maxAttempts: 2, delayMs: 500 }
                        );
                        content = String(result).slice(0, LIMITS.maxResultChars);
                        durationMs = Date.now() - start;
                    } catch (err) {
                        content = `Tool "${fnName}" failed: ${err.message}`;
                        durationMs = Date.now() - start;
                    }

                    logger.tool(fnName, fnArgs, content, durationMs);

                    // Notify caller — tool finished
                    onToolResult(fnName, content);

                    return { tc, content };
                })
            );

            // Add results to messages
            for (const settled of toolResults) {
                if (settled.status === "fulfilled") {
                    const { tc, content } = settled.value;
                    messages.push({
                        role: "tool",
                        tool_call_id: tc.id,
                        content
                    });
                }
            }

            // Continue loop — LLM will read results
        }
    }
}