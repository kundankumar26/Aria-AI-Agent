// utils/intentDetector.js — updated for multi-turn

export function detectIntent(message, thread) {
    const msg = message.toLowerCase().trim();
    const hasHistory = thread?.messages?.length > 0;

    // ── Follow-up patterns ─────────────────────────────
    const followUpPatterns = [
        /^(what|who|how|why|when|where) (did|does|was|were|is|are) (you|it|that|this|they)/,
        /^(can you|could you|please) (explain|clarify|elaborate|expand)/,
        /^(tell me more|go deeper|more detail|elaborate)/,
        /^(summarise|summarize|simplify|make it simpler)/,
        /^(what about|how about|and what about)/,
        /^(that|this|it|those|these) (is|was|seems|looks)/,
        /^(based on that|given that|from what you said)/,
        /\b(you mentioned|you said|you found|earlier|above|that research)\b/,
        /^(now|also|additionally|furthermore|besides that)/,
        /^(yes|no|ok|okay|got it|thanks|great|perfect|interesting)/
    ];

    const isFollowUp = hasHistory && followUpPatterns.some(p => p.test(msg));

    // ── Command patterns ────────────────────────────────
    const commandPatterns = {
        send_email: /^send (it|the email|that)/,
        save_note: /^save (this|that|it)/,
        add_calendar: /^(add|schedule|book|set) (this |that |it )?(to|on|in) (my |the )?(calendar|schedule)/,
        revise_email: /^revise:/
    };

    for (const [command, pattern] of Object.entries(commandPatterns)) {
        if (pattern.test(msg)) {
            return {
                type: "command",
                label: command,
                requiresPlanning: false,
                isFollowUp: false
            };
        }
    }

    // ── New research topic ──────────────────────────────
    const researchPatterns = [
        /^(research|find out|investigate|look into|search for)/,
        /^(what is|what are|explain|tell me about|how does|why does)/,
        /^(compare|analyse|analyze|evaluate|review)/
    ];

    const isResearch = researchPatterns.some(p => p.test(msg));

    if (isFollowUp) {
        return {
            type: "follow_up",
            label: "follow-up question",
            requiresPlanning: false,
            isFollowUp: true
        };
    }

    if (isResearch) {
        return {
            type: "new_topic",
            label: "new research",
            requiresPlanning: true,
            isFollowUp: false
        };
    }

    // ── Life tool request ───────────────────────────────
    const lifeToolPatterns = [
        /\b(weather|forecast|temperature|rain|sunny)\b/,
        /\b(calendar|schedule|meeting|appointment|remind)\b/,
        /\b(email|gmail|inbox|unread|message)\b/,
        /\b(news|headlines|happening|latest)\b/,
        /\b(morning briefing|brief me|catch me up)\b/
    ];

    if (lifeToolPatterns.some(p => p.test(msg))) {
        return {
            type: "life_tool",
            label: "life tool request",
            requiresPlanning: false,
            isFollowUp: isFollowUp
        };
    }

    // ── Default — treat as new topic ───────────────────
    return {
        type: "new_topic",
        label: "general query",
        requiresPlanning: msg.length > 20,  // only plan for substantial queries
        isFollowUp: false
    };
}
export function detectQueryIntent(query) {
    const q = query.toLowerCase();

    // Quick fact check
    if (q.startsWith("what is") ||
        q.startsWith("who is") ||
        q.startsWith("when did") ||
        q.startsWith("define ")) {
        return { type: "quick", targetWords: 150, sections: 2 };
    }

    // Deep research
    if (q.includes("explain") ||
        q.includes("research") ||
        q.includes("deep dive") ||
        q.includes("comprehensive")) {
        return { type: "deep", targetWords: 1000, sections: 5 };
    }

    // Comparison
    if (q.includes(" vs ") ||
        q.includes("compare") ||
        q.includes("difference between")) {
        return { type: "compare", targetWords: 700, sections: 4 };
    }

    // Default — standard research
    return { type: "standard", targetWords: 600, sections: 4 };
}