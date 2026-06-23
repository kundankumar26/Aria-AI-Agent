// utils/documentIndexer.js

import path from "path";
import { addToVectorStore } from "./vectorStore.js";
import { addToRegistry } from "./documentProcessor.js";
import { logger } from "./logger.js";

export async function indexDocument(processedDoc) {
    logger.info(`Indexing: ${processedDoc.filename} (${processedDoc.wordCount} words)`);

    // Generate document ID
    const docId = `doc_${Date.now()}_${processedDoc.filename
        .replace(/[^a-z0-9]/gi, "_").toLowerCase()}`;

    // Smart chunking based on document type
    const chunks = chunkDocument(processedDoc);

    logger.info(`Created ${chunks.length} chunks`);

    // Embed all chunks — in batches to avoid rate limits
    const BATCH_SIZE = 10;
    let indexed = 0;

    for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
        const batch = chunks.slice(i, i + BATCH_SIZE);

        await Promise.all(
            batch.map(chunk =>
                addToVectorStore({
                    filename: processedDoc.filename,
                    content: chunk.content,
                    metadata: {
                        docId,
                        chunkIndex: chunk.index,
                        section: chunk.section,
                        pageHint: chunk.pageHint
                    }
                })
            )
        );

        indexed += batch.length;
        logger.info(`  Indexed ${indexed}/${chunks.length} chunks`);
    }

    // Register document
    await addToRegistry({
        docId,
        filename: processedDoc.filename,
        fileType: processedDoc.fileType,
        wordCount: processedDoc.wordCount,
        pageCount: processedDoc.pageCount,
        chunkCount: chunks.length,
        processedAt: processedDoc.processedAt,
        info: processedDoc.info || {}
    });

    logger.info(`✅ Document indexed: ${docId}`);

    return {
        docId,
        filename: processedDoc.filename,
        chunkCount: chunks.length,
        wordCount: processedDoc.wordCount
    };
}

// ── Smart document chunker ───────────────────────────────
function chunkDocument(doc) {
    const text = doc.text;

    // For very small documents — one chunk
    if (doc.wordCount < 200) {
        return [{ index: 0, content: text, section: "full", pageHint: 1 }];
    }

    // Split by natural boundaries first
    const sections = splitBySections(text);
    const chunks = [];

    sections.forEach((section, sIdx) => {
        const words = section.content.split(/\s+/);

        // If section is short enough — keep as one chunk
        if (words.length <= 400) {
            chunks.push({
                index: chunks.length,
                content: section.content,
                section: section.heading || `Section ${sIdx + 1}`,
                pageHint: Math.ceil((sIdx + 1) / 2)
            });
            return;
        }

        // Split long sections into overlapping chunks
        const CHUNK_SIZE = 400;
        const OVERLAP = 50;

        for (let i = 0; i < words.length; i += CHUNK_SIZE - OVERLAP) {
            const chunkWords = words.slice(i, i + CHUNK_SIZE);
            if (chunkWords.length < 20) break;

            chunks.push({
                index: chunks.length,
                content: chunkWords.join(" "),
                section: section.heading || `Section ${sIdx + 1}`,
                pageHint: Math.ceil(i / 500) + 1
            });

            if (i + CHUNK_SIZE >= words.length) break;
        }
    });

    return chunks;
}

// Split text into sections by headings
function splitBySections(text) {
    // Detect markdown/document headings
    const headingPattern = /^(#{1,3}\s+.+|[A-Z][A-Z\s]{4,50}$)/gm;
    const parts = text.split(headingPattern);

    if (parts.length <= 2) {
        // No headings found — return as single section
        return [{ heading: "Document", content: text }];
    }

    const sections = [];
    for (let i = 0; i < parts.length; i += 2) {
        const heading = parts[i - 1]?.trim() || "Document";
        const content = parts[i]?.trim() || "";
        if (content.length > 50) {
            sections.push({ heading, content });
        }
    }

    return sections.length > 0
        ? sections
        : [{ heading: "Document", content: text }];
}