// Keep messages array from growing too large
export function trimMessages(messages, maxMessages = 20) {
    if (messages.length <= maxMessages) return [...messages];

    const system = messages[0];           // always keep system prompt
    const user = messages[1];             // always keep original request

    // Calculate how many recent messages to keep
    const alwaysKeep = 2; // system + user
    const notice = {
        role: "system",
        content: `[Earlier conversation trimmed to save context. 
               Original request was: "${user.content}"]`
    };

    const recentCount = Math.max(1, maxMessages - alwaysKeep - 1); // -1 for notice
    const recent = messages.slice(-recentCount);

    let trimmed = [system, notice, ...recent];

    // Ensure no trailing 'tool' message unless it follows an 'assistant' with tool_calls
    while (
        trimmed.length > 0 &&
        trimmed[trimmed.length - 1].role === 'tool' &&
        (trimmed.length < 2 ||
            trimmed[trimmed.length - 2].role !== 'assistant' ||
            trimmed[trimmed.length - 2].tool_calls === undefined)
    ) {
        trimmed.pop();
    }

    return trimmed;
}