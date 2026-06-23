// server.js — full rewrite

import http from "http";
import fs from "fs/promises";
import path from "path";
import "dotenv/config";

import { runAgentStreaming } from "./agent.js";
import {
    newConversationId,
    saveConversation,
    loadConversation,
    listConversations,
    deleteConversation
} from "./utils/conversationStore.js";
import { TurnManager } from "./utils/turnManager.js";
import { detectIntent } from "./utils/intentDetector.js";
import { processDocument } from "./utils/documentProcessor.js";
import { indexDocument } from "./utils/documentIndexer.js";

const PORT = process.env.PORT || 3000;

// ── Parse request body ──────────────────────────────────
function parseBody(req) {
    return new Promise((resolve, reject) => {
        let body = "";
        req.on("data", chunk => body += chunk);
        req.on("end", () => {
            try { resolve(JSON.parse(body)); }
            catch { resolve({}); }
        });
        req.on("error", reject);
    });
}

// ── JSON response helper ────────────────────────────────
function json(res, status, data) {
    res.writeHead(status, { "Content-Type": "application/json" });
    res.end(JSON.stringify(data));
}

// ── CORS headers ────────────────────────────────────────
function setCors(res) {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

const server = http.createServer(async (req, res) => {
    setCors(res);

    if (req.method === "OPTIONS") {
        res.writeHead(200); res.end(); return;
    }

    const url = req.url;

    // ── Serve HTML UI ─────────────────────────────────────
    if (req.method === "GET" && url === "/") {
        const html = await fs.readFile("public/index.html", "utf-8");
        res.writeHead(200, { "Content-Type": "text/html" });
        res.end(html);
        return;
    }

    // ── Health check ──────────────────────────────────────
    if (req.method === "GET" && url === "/health") {
        json(res, 200, { status: "ok", agent: "Aria" });
        return;
    }

    // ── List conversations ────────────────────────────────
    if (req.method === "GET" && url === "/conversations") {
        const list = await listConversations();
        json(res, 200, list);
        return;
    }

    // ── Load a conversation ───────────────────────────────
    if (req.method === "GET" && url.startsWith("/conversations/")) {
        const id = url.split("/")[2];
        const conv = await loadConversation(id);
        if (!conv) { json(res, 404, { error: "Not found" }); return; }
        json(res, 200, conv);
        return;
    }

    // ── Delete a conversation ─────────────────────────────
    if (req.method === "DELETE" && url.startsWith("/conversations/")) {
        const id = url.split("/")[2];
        await deleteConversation(id);
        json(res, 200, { deleted: true });
        return;
    }

    // ── Streaming research with conversation support ────────
    if (req.method === "POST" && url === "/research/stream") {
        const body = await parseBody(req);
        const { query, conversationId } = body;

        if (!query?.trim()) {
            json(res, 400, { error: "query required" }); return;
        }

        // Set up SSE
        res.writeHead(200, {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        });

        const sendEvent = (event, data) => {
            try {
                res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
            } catch { }
        };

        // Create turn manager with existing or new conversation ID
        const manager = new TurnManager(conversationId);
        await manager.init(query);

        sendEvent("conv_id", { conversationId: manager.conversationId });
        sendEvent("intent", { intent: detectIntent(query, manager.thread) });

        // // Load or create conversation
        // const convId = conversationId || newConversationId();
        // let conv = (await loadConversation(convId)) || {
        //     id: convId,
        //     title: query.slice(0, 50),
        //     messages: [],
        //     createdAt: new Date().toISOString(),
        //     updatedAt: new Date().toISOString()
        // };

        try {
            await manager.processTurn(query, {
                onToolCall: (name, args) => sendEvent("tool_start", { tool: name, args }),
                onToolResult: (name) => sendEvent("tool_done", { tool: name }),
                onToken: (token) => sendEvent("token", { token }),
                onDone: async (text) => {
                    sendEvent("done", {
                        conversationId: manager.conversationId,
                        turnCount: manager.thread?.turnCount,
                        wordCount: text.split(" ").length
                    });
                    res.end();
                },
                onError: (err) => {
                    sendEvent("error", { message: err.message });
                    res.end();
                }
            });

        } catch (err) {
            sendEvent("error", { message: err.message });
            res.end();
        }

        return;
    }

    // ── File upload endpoint ──────────────────────────────────
    if (req.method === "POST" && url === "/upload") {

        // Parse multipart form data
        const boundary = req.headers["content-type"]?.split("boundary=")[1];

        if (!boundary) {
            json(res, 400, { error: "No boundary in content-type" }); return;
        }

        const chunks = [];
        for await (const chunk of req) chunks.push(chunk);
        const buffer = Buffer.concat(chunks);

        // Extract file from multipart body
        const { filename, fileBuffer } = parseMultipart(buffer, boundary);

        if (!filename || !fileBuffer) {
            json(res, 400, { error: "No file found in upload" }); return;
        }

        // Save temp file
        const tempPath = `uploaded-docs/temp_${Date.now()}_${filename}`;
        await fs.writeFile(tempPath, fileBuffer);

        try {
            // Process the document
            const processed = await processDocument(tempPath, filename);

            // Index into vector store
            const indexed = await indexDocument(processed);

            // Clean up temp file
            await fs.unlink(tempPath);

            json(res, 200, {
                success: true,
                filename,
                wordCount: indexed.wordCount,
                chunkCount: indexed.chunkCount,
                message: `✅ "${filename}" processed and indexed (${indexed.wordCount} words, ${indexed.chunkCount} chunks)`
            });

        } catch (err) {
            // Clean up on error
            try { await fs.unlink(tempPath); } catch { }
            json(res, 500, { error: err.message });
        }

        return;
    }

    // ── Simple multipart parser ─────────────────────────────
    function parseMultipart(buffer, boundary) {
        const boundaryBuf = Buffer.from(`--${boundary}`);
        const parts = [];

        let start = 0;
        while (start < buffer.length) {
            const bIdx = buffer.indexOf(boundaryBuf, start);
            if (bIdx === -1) break;

            const end = buffer.indexOf(boundaryBuf, bIdx + boundaryBuf.length);
            if (end === -1) break;

            parts.push(buffer.slice(bIdx + boundaryBuf.length, end));
            start = end;
        }

        for (const part of parts) {
            const headerEnd = part.indexOf("\r\n\r\n");
            if (headerEnd === -1) continue;

            const headers = part.slice(0, headerEnd).toString();
            const content = part.slice(headerEnd + 4);

            const nameMatch = headers.match(/name="([^"]+)"/);
            const fileMatch = headers.match(/filename="([^"]+)"/);

            if (nameMatch?.[1] === "file" && fileMatch?.[1]) {
                return {
                    filename: fileMatch[1],
                    fileBuffer: content.slice(0, content.length - 2) // trim trailing \r\n
                };
            }
        }

        return {};
    }


    json(res, 404, { error: "Not found" });
});

server.listen(PORT, () => {
    console.log(`\n🚀 Aria running at http://localhost:${PORT}\n`);
});
