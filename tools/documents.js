// tools/documents.js

import fs from "fs/promises";
import path from "path";
import { processDocument } from "../utils/documentProcessor.js";
import { indexDocument } from "../utils/documentIndexer.js";
import { searchVectorStore } from "../utils/vectorStore.js";
import { loadRegistry } from "../utils/documentProcessor.js";
import { logger } from "../utils/logger.js";

const UPLOAD_DIR = "uploaded-docs";

// ── Tool 1: Search documents ────────────────────────────
export const searchDocumentsTool = {
    type: "function",
    function: {
        name: "search_documents",
        description: `Search through uploaded documents (PDFs, Word docs,
                  spreadsheets) for specific information.
                  Use when user references an uploaded file or asks
                  about document content.`,
        parameters: {
            type: "object",
            properties: {
                query: {
                    type: "string",
                    description: "What to search for in the documents"
                },
                filename: {
                    type: "string",
                    description: "Specific filename to search in (optional — searches all if omitted)"
                },
                top_results: {
                    type: "number",
                    description: "Number of results to return (default 5)"
                }
            },
            required: ["query"]
        }
    }
};

export async function search_documents({ query, filename, top_results = 5 }) {
    const results = await searchVectorStore(query, top_results * 2);

    // Filter by filename if specified
    const filtered = filename
        ? results.filter(r =>
            r.source?.toLowerCase().includes(filename.toLowerCase())
        )
        : results;

    if (filtered.length === 0) {
        const registry = await loadRegistry();
        if (registry.length === 0) {
            return "No documents uploaded yet. Upload a file to get started.";
        }
        return `No relevant content found for "${query}" in your documents.
Available documents: ${registry.map(r => r.filename).join(", ")}`;
    }

    return filtered.slice(0, top_results).map((r, i) =>
        `[${i + 1}] From: ${r.source} | Match: ${r.score}%
${r.content}
${r.metadata?.section ? `Section: ${r.metadata.section}` : ""}`
    ).join("\n\n───\n\n");
}

// ── Tool 2: List documents ──────────────────────────────
export const listDocumentsTool = {
    type: "function",
    function: {
        name: "list_documents",
        description: `List all uploaded documents in the knowledge base.
                  Use when user asks "what files do I have" or
                  "what documents have I uploaded".`,
        parameters: {
            type: "object",
            properties: {}
        }
    }
};

export async function list_documents() {
    const registry = await loadRegistry();

    if (registry.length === 0) {
        return "No documents uploaded yet.";
    }

    return registry.map((doc, i) =>
        `[${i + 1}] ${doc.filename}
    Type: ${doc.fileType} | Words: ${doc.wordCount.toLocaleString()} | Pages: ${doc.pageCount || "?"}
    Indexed: ${new Date(doc.processedAt).toLocaleDateString("en-IN")} | Chunks: ${doc.chunkCount}`
    ).join("\n\n");
}

// ── Tool 3: Get document summary ────────────────────────
export const getDocumentSummaryTool = {
    type: "function",
    function: {
        name: "get_document_summary",
        description: `Get a comprehensive summary of an uploaded document.
                  Use when user uploads a file and asks to summarise it,
                  or asks "what is this document about".`,
        parameters: {
            type: "object",
            properties: {
                filename: {
                    type: "string",
                    description: "Name of the file to summarise"
                }
            },
            required: ["filename"]
        }
    }
};

export async function get_document_summary({ filename }) {
    // Search for the document's content broadly
    const results = await searchVectorStore(
        `summary overview introduction conclusion ${filename}`,
        15
    );

    const docChunks = results.filter(r =>
        r.source?.toLowerCase().includes(filename.toLowerCase())
    );

    if (docChunks.length === 0) {
        return `Document "${filename}" not found. Check spelling or upload the file first.`;
    }

    // Get registry info
    const registry = await loadRegistry();
    const docInfo = registry.find(r =>
        r.filename.toLowerCase() === filename.toLowerCase()
    );

    const context = docChunks
        .slice(0, 8)
        .map(c => c.content)
        .join("\n\n");

    return `Document: ${filename}
${docInfo ? `Type: ${docInfo.fileType} | Words: ${docInfo.wordCount} | Pages: ${docInfo.pageCount || "?"}` : ""}

Content sample (${docChunks.length} relevant sections found):
${context.slice(0, 3000)}`;
}