// utils/turnManager.js

import {
    loadThread, createThread,
    saveThread, appendTurn,
    newConversationId
} from "./conversationStore.js";
import { buildSystemPrompt } from "../prompts/systemPrompt.js";
import {
    loadUserProfile,
    findRelatedNotes
} from "../memory.js";
import { loadCache } from "./cache.js";
import { loadVectorStore } from "./vectorStore.js";
import { planResearch } from "./planner.js";
import { manageContextWindow } from "./contextManager.js";
import { detectIntent } from "./intentDetector.js";
import {
    toolDefinitions,
    toolFunctions
} from "../tools/index.js";
import { runStreamingAgentLoop } from "./streamingAgentLoop.js";
import { logger } from "./logger.js";

export class TurnManager {

    constructor(conversationId = null) {
        this.conversationId = conversationId || newConversationId();
        this.thread = null;
        this.userProfile = null;
    }

    // ── Initialise (load or create thread) ──────────────
    async init(firstMessage) {
        const [userProfile] = await Promise.all([
            loadUserProfile(),
            loadCache(),
            loadVectorStore()
        ]);

        this.userProfile = userProfile;
        this.thread = await loadThread(this.conversationId);

        if (!this.thread) {
            this.thread = await createThread(this.conversationId, firstMessage);
            logger.info(`New conversation: ${this.conversationId}`);
        } else {
            logger.info(`Resuming conversation: ${this.conversationId} (${this.thread.turnCount} turns)`);
        }
    }

    // ── Process one turn ─────────────────────────────────
    async processTurn(userMessage, callbacks = {}) {
        if (!this.thread) await this.init(userMessage);

        // Detect intent — is this a follow-up or new topic?
        const intent = detectIntent(userMessage, this.thread);
        logger.info(`Intent: ${intent.type} — ${intent.label}`);

        // Build system prompt
        const relatedNotes = intent.type === "new_topic"
            ? await findRelatedNotes(userMessage)
            : null;  // skip KB search for follow-ups

        const systemPrompt = buildSystemPrompt(
            this.userProfile,
            relatedNotes,
            this.thread  // pass conversation context
        );

        // Research planning for new research topics only
        const plan = intent.requiresPlanning
            ? await planResearch(userMessage, this.userProfile)
            : null;

        // Build the messages array — system + full history + new message
        const messages = [
            { role: "system", content: systemPrompt },
            ...this.thread.messages,           // ← full conversation history
            {
                role: "user",
                content: plan
                    ? buildEnhancedMessage(userMessage, plan)
                    : userMessage
            }
        ];

        // Manage context window — summarise if too long
        const managedMessages = await manageContextWindow(messages);

        // Run agent loop
        let fullResponse = "";
        let toolCallCount = 0;

        const wrappedCallbacks = {
            ...callbacks,
            onToolCall: (name, args) => {
                toolCallCount++;
                callbacks.onToolCall?.(name, args);
            },
            onDone: async (text) => {
                fullResponse = text;

                // Persist the completed turn
                await appendTurn(
                    this.conversationId,
                    userMessage,
                    fullResponse,
                    toolCallCount
                );

                // Reload thread to keep in sync
                this.thread = await loadThread(this.conversationId);

                callbacks.onDone?.(text);
            }
        };

        await runStreamingAgentLoop(
            managedMessages,
            toolDefinitions,
            toolFunctions,
            wrappedCallbacks
        );

        return fullResponse;
    }
}

function buildEnhancedMessage(userMessage, plan) {
    return `Research request: "${userMessage}"

    Research plan:
    Sub-questions: ${plan.sub_questions.map((q, i) => `${i + 1}. ${q}`).join("\n")}
    Search queries: ${plan.search_queries.map(q => `"${q}"`).join(", ")}
    Source priorities: ${plan.source_priorities.join(", ")}`;
}