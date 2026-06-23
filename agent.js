import { buildSystemPrompt, buildEnhancedMessage } from "./prompts/systemPrompt.js";
import {
    loadUserProfile,
    findRelatedNotes
} from "./memory.js";
import {
    toolDefinitions,
    toolFunctions
} from "./tools/index.js";
import { runAgentLoop } from "./utils/agentLoop.js";
import { planResearch } from "./utils/planner.js";
import { logger } from "./utils/logger.js";
import { reviewResponse } from "./utils/reviewer.js";
import { detectQueryIntent } from "./utils/intentDetector.js";
import { runStreamingAgentLoop } from "./utils/streamingAgentLoop.js";
import { loadCache } from "./utils/cache.js";

export async function runAgent(userMessage) {

    // ── Startup ────────────────────────────────────────
    logger.info("\n🔍 Loading profile and past research...");

    // const userProfile = await loadUserProfile();
    // const relatedNotes = await findRelatedNotes(userMessage);
    const [userProfile, relatedNotes] = await Promise.all([
        loadUserProfile(),
        findRelatedNotes(userMessage)
    ]);
    let systemPrompt = buildSystemPrompt(userProfile, relatedNotes);

    // ── Research planning ────────────────────────────────
    const plan = await planResearch(userMessage, userProfile);

    // ── Detect query intent ───────────────────────────────
    const intent = detectQueryIntent(userMessage);

    logger.info(`Query intent: ${intent.type} — target ${intent.targetWords} words`);

    const depthInstruction = `
        Response depth for this query: ${intent.type}
        Target word count: ${intent.targetWords} words
        Number of sections: ${intent.sections}
    `;

    systemPrompt += "\n\n" + depthInstruction;

    // ── Build enhanced message with plan ─────────────────
    const enhancedMessage = buildEnhancedMessage(userMessage, plan);

    // ── Initialise messages ────────────────────────────
    const messages = [
        { role: "system", content: systemPrompt },
        { role: "user", content: enhancedMessage }
    ];

    logger.info("🤖 Aria is thinking...\n");

    if (relatedNotes) {
        logger.info("📂 Found related past research — loading context...\n");
    }

    // ── Run the agent loop ─────────────────────────────
    const answer = await runAgentLoop(messages, toolDefinitions, toolFunctions);

    // ── Self-review ───────────────────────────────────────
    const review = await reviewResponse(answer, userMessage, userProfile);

    if (review) {
        logger.info(`Review score: ${review.quality_score}/10 | verdict: ${review.verdict}`);

        if (review.issues?.length > 0) {
            logger.info(`Issues found: ${review.issues.join(", ")}`);
        }

        // If quality is low — add improvement note to response
        if (review.quality_score < 6 && review.improvement_note) {
            answer += `\n\n---\n⚠️ *Note: ${review.improvement_note}*`;
        }

        // Log quality metrics for your own tracking
        logger.info(`Word count: ${review.word_count} | Has data: ${review.has_specific_data}`);
    }

    return answer;
}

export async function runAgentStreaming(userMessage, callbacks = {}) {

    let userProfile, relatedNotes;
    await Promise.all([
        loadCache(),
        loadUserProfile().then(p => userProfile = p),
        findRelatedNotes(userMessage).then(n => relatedNotes = n)
    ]);

    const plan = await planResearch(userMessage, userProfile);
    let systemPrompt = buildSystemPrompt(userProfile, relatedNotes);
    const enhanced = buildEnhancedMessage(userMessage, plan);

    // ── Detect query intent ───────────────────────────────
    const intent = detectQueryIntent(userMessage);

    logger.info(`Query intent: ${intent.type} — target ${intent.targetWords} words`);

    const depthInstruction = `
        Response depth for this query: ${intent.type}
        Target word count: ${intent.targetWords} words
        Number of sections: ${intent.sections}
    `;

    systemPrompt += "\n\n" + depthInstruction;


    const messages = [
        { role: "system", content: systemPrompt },
        { role: "user", content: enhanced }
    ];

    return await runStreamingAgentLoop(
        messages,
        toolDefinitions,
        toolFunctions,
        callbacks
    );
}