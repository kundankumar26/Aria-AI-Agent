import { buildSystemPrompt } from "./prompts/systemPrompt.js";
import {
    loadUserProfile,
    findRelatedNotes
} from "./memory.js";
import {
    toolDefinitions,
    toolFunctions
} from "./tools/index.js";
import { runAgentLoop } from "./utils/agentLoop.js";


export async function runAgent(userMessage) {

    // ── Startup ────────────────────────────────────────
    console.log("\n🔍 Loading profile and past research...");

    const userProfile = await loadUserProfile();
    const relatedNotes = await findRelatedNotes(userMessage);
    const systemPrompt = buildSystemPrompt(userProfile, relatedNotes);

    // add planning step before main loop
    const plan = await planResearch(userMessage);

    // Inject plan into user message
    const enhancedMessage = plan
        ? `Research this topic: "${userMessage}"
         
         Research plan to follow:
         Sub-questions: ${plan.subQuestions.join(", ")}
         Search queries to use: ${plan.searchQueries.join(", ")}
         Prioritise these source types: ${plan.sourceTypes.join(", ")}`
        : userMessage;

    // ── Initialise messages ────────────────────────────
    const messages = [
        { role: "system", content: systemPrompt },
        { role: "user", content: enhancedMessage }
    ];

    console.log("🤖 Aria is thinking...\n");

    if (relatedNotes) {
        console.log("📂 Found related past research — loading context...\n");
    }

    // ── Run the agent loop ─────────────────────────────
    const answer = await runAgentLoop(messages, toolDefinitions, toolFunctions);

    return answer;
}

async function planResearch(topic) {
    const response = await client.chat.completions.create({
        model: "gpt-4o",
        temperature: 0.2,
        messages: [{
            role: "user",
            content: `You are a research planner. For the topic "${topic}":
                1. Break it into 3-4 key sub-questions to investigate
                2. Suggest 4 specific search queries (varied angles)
                3. Identify what type of sources would be most credible
                Return as JSON: { subQuestions, searchQueries, sourceTypes }`
        }]
    });

    try {
        return JSON.parse(response.choices[0].message.content);
    } catch {
        return null;
    }
}