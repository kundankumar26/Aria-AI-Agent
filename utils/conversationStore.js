// utils/conversationStore.js

import fs from "fs/promises";
import path from "path";

const STORE_DIR = "conversations";

// Ensure directory exists
async function ensureDir() {
    try {
        await fs.mkdir(STORE_DIR, { recursive: true });
    } catch { }
}

// Generate a conversation ID
export function newConversationId() {
    return `conv_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

// Save a conversation
export async function saveConversation(id, data) {
    await ensureDir();
    await fs.writeFile(
        path.join(STORE_DIR, `${id}.json`),
        JSON.stringify(data, null, 2)
    );
}

// Load a conversation
export async function loadConversation(id) {
    try {
        const raw = await fs.readFile(
            path.join(STORE_DIR, `${id}.json`), "utf-8"
        );
        return JSON.parse(raw);
    } catch {
        return null;
    }
}

// List all conversations (for sidebar)
export async function listConversations() {
    await ensureDir();
    try {
        const files = await fs.readdir(STORE_DIR);
        const convs = await Promise.all(
            files
                .filter(f => f.endsWith(".json"))
                .map(async f => {
                    const raw = await fs.readFile(path.join(STORE_DIR, f), "utf-8");
                    const data = JSON.parse(raw);
                    return {
                        id: data.id,
                        title: data.title || "Untitled",
                        updatedAt: data.updatedAt,
                        preview: data.messages?.find(m => m.role === "user")?.content?.slice(0, 60) || ""
                    };
                })
        );

        // Sort by most recent first
        return convs.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
    } catch {
        return [];
    }
}

// Delete a conversation
export async function deleteConversation(id) {
    try {
        await fs.unlink(path.join(STORE_DIR, `${id}.json`));
        return true;
    } catch {
        return false;
    }
}

// Create a new conversation thread
export async function createThread(id, firstMessage) {
    await ensureDir();

    const thread = {
        id,
        title: firstMessage.slice(0, 60),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        turnCount: 0,
        // LLM messages array — grows with each turn
        messages: [],
        // Human-readable turn summaries — for sidebar display
        turns: []
    };

    await saveThread(thread);
    return thread;
}

// Load a thread from disk
export async function loadThread(id) {
    try {
        const raw = await fs.readFile(
            path.join(STORE_DIR, `${id}.json`), "utf-8"
        );
        return JSON.parse(raw);
    } catch {
        return null;
    }
}

// Save thread to disk
export async function saveThread(thread) {
    await ensureDir();
    thread.updatedAt = new Date().toISOString();
    await fs.writeFile(
        path.join(STORE_DIR, `${thread.id}.json`),
        JSON.stringify(thread, null, 2)
    );
}

// Append a completed turn to the thread
export async function appendTurn(threadId, userMessage, assistantResponse, toolCallCount) {
    const thread = await loadThread(threadId);
    if (!thread) throw new Error(`Thread ${threadId} not found`);

    // Add to LLM messages array
    thread.messages.push(
        { role: "user", content: userMessage },
        { role: "assistant", content: assistantResponse }
    );

    // Add to human-readable turns
    thread.turns.push({
        turnNumber: ++thread.turnCount,
        timestamp: new Date().toISOString(),
        userMessage: userMessage.slice(0, 100),
        responsePreview: assistantResponse.slice(0, 150),
        toolCallCount
    });

    await saveThread(thread);
    return thread;
}

// List all threads for sidebar
export async function listThreads() {
    await ensureDir();
    try {
        const files = await fs.readdir(STORE_DIR);
        const threads = await Promise.all(
            files
                .filter(f => f.endsWith(".json"))
                .map(async f => {
                    const raw = await fs.readFile(path.join(STORE_DIR, f), "utf-8");
                    const data = JSON.parse(raw);
                    return {
                        id: data.id,
                        title: data.title,
                        updatedAt: data.updatedAt,
                        turnCount: data.turnCount || 0,
                        preview: data.turns?.[data.turns.length - 1]?.userMessage || ""
                    };
                })
        );
        return threads.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
    } catch {
        return [];
    }
}

export async function deleteThread(id) {
    try {
        await fs.unlink(path.join(STORE_DIR, `${id}.json`));
        return true;
    } catch { return false; }
}