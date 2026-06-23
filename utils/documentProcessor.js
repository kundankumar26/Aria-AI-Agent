// utils/documentProcessor.js

import fs from "fs/promises";
import path from "path";
// PDF extraction libraries removed to avoid import/runtime issues in ESM.
// processPDF will provide a safe fallback so the app can run without
// additional native/build dependencies. For full PDF text extraction,
// install and configure a PDF parsing library and re-enable extraction.
import mammoth from "mammoth";
import * as XLSX from "xlsx";
import { logger } from "./logger.js";

const DOCS_DIR = "uploaded-docs";
const REGISTRY_PATH = "uploaded-docs/registry.json";

// ── Ensure directories exist ─────────────────────────────
export async function ensureDocsDir() {
    await fs.mkdir(DOCS_DIR, { recursive: true });
}

// ── Registry: track all uploaded documents ───────────────
export async function loadRegistry() {
    try {
        const raw = await fs.readFile(REGISTRY_PATH, "utf-8");
        return JSON.parse(raw);
    } catch {
        return [];
    }
}

export async function saveRegistry(registry) {
    await ensureDocsDir();
    await fs.writeFile(REGISTRY_PATH, JSON.stringify(registry, null, 2));
}

export async function addToRegistry(entry) {
    const registry = await loadRegistry();

    // Replace if same filename already exists
    const existingIdx = registry.findIndex(r => r.filename === entry.filename);
    if (existingIdx >= 0) registry[existingIdx] = entry;
    else registry.push(entry);

    await saveRegistry(registry);
}

// ── Main processor ───────────────────────────────────────
export async function processDocument(filePath, originalName) {
    await ensureDocsDir();

    const ext = path.extname(originalName).toLowerCase();
    const fileSize = (await fs.stat(filePath)).size;

    logger.info(`Processing document: ${originalName} (${(fileSize / 1024).toFixed(1)}KB)`);

    let result;

    switch (ext) {
        case ".pdf":
            result = await processPDF(filePath);
            break;
        case ".docx":
        case ".doc":
            result = await processWord(filePath);
            break;
        case ".xlsx":
        case ".xls":
            result = await processExcel(filePath);
            break;
        case ".csv":
            result = await processCSV(filePath);
            break;
        case ".txt":
        case ".md":
            result = await processText(filePath);
            break;
        case ".html":
        case ".htm":
            result = await processHTML(filePath);
            break;
        default:
            throw new Error(`Unsupported file type: ${ext}. Supported: PDF, DOCX, XLSX, CSV, TXT, MD, HTML`);
    }

    // Add metadata
    result.filename = originalName;
    result.fileType = ext.slice(1).toUpperCase();
    result.fileSize = fileSize;
    result.processedAt = new Date().toISOString();
    result.wordCount = result.text.split(/\s+/).length;
    result.charCount = result.text.length;

    logger.info(`Extracted: ${result.wordCount} words, ${result.pageCount || "?"} pages`);

    return result;
}

// ── PDF processor ────────────────────────────────────────
async function processPDF(filePath) {
    // Minimal, dependency-free fallback: return file metadata and an
    // empty text body so the app remains functional. This avoids requiring
    // problematic native/CJS PDF libraries at runtime.
    try {
        const stats = await fs.stat(filePath);
        return {
            text: "",
            pageCount: null,
            info: {
                filename: path.basename(filePath),
                size: stats.size
            },
            warning: "PDF text extraction disabled. Install a PDF parser for full extraction."
        };
    } catch (err) {
        return {
            text: "",
            pageCount: null,
            info: {},
            warning: `Failed to read PDF: ${err.message}`
        };
    }
}

// ── Word processor ───────────────────────────────────────
async function processWord(filePath) {
    const buffer = await fs.readFile(filePath);
    const result = await mammoth.extractRawText({ buffer });

    return {
        text: cleanText(result.value),
        pageCount: null,  // Word doesn't expose page count easily
        warnings: result.messages.map(m => m.message)
    };
}

// ── Excel processor ──────────────────────────────────────
async function processExcel(filePath) {
    const buffer = await fs.readFile(filePath);
    const workbook = XLSX.read(buffer, { type: "buffer" });

    const sheets = {};
    let allText = "";

    workbook.SheetNames.forEach(sheetName => {
        const sheet = workbook.Sheets[sheetName];
        const csv = XLSX.utils.sheet_to_csv(sheet);

        // Clean up empty rows
        const cleaned = csv
            .split("\n")
            .filter(row => row.replace(/,/g, "").trim().length > 0)
            .join("\n");

        sheets[sheetName] = cleaned;
        allText += `\n\n=== Sheet: ${sheetName} ===\n${cleaned}`;
    });

    return {
        text: cleanText(allText),
        pageCount: workbook.SheetNames.length,
        sheetNames: workbook.SheetNames,
        sheets
    };
}

// ── CSV processor ────────────────────────────────────────
async function processCSV(filePath) {
    const raw = await fs.readFile(filePath, "utf-8");
    const rows = raw.split("\n").filter(r => r.trim().length > 0);

    // Get headers
    const headers = rows[0];
    const dataRows = rows.slice(1, 6);  // preview first 5 rows

    const text = `CSV File: ${rows.length - 1} data rows
Headers: ${headers}
Sample data:
${dataRows.join("\n")}
... [${rows.length - 6} more rows]`;

    return {
        text: cleanText(raw),  // full text for embedding
        pageCount: 1,
        rowCount: rows.length - 1,
        preview: text
    };
}

// ── Text/Markdown processor ──────────────────────────────
async function processText(filePath) {
    const text = await fs.readFile(filePath, "utf-8");
    return {
        text: cleanText(text),
        pageCount: Math.ceil(text.length / 3000)  // estimate
    };
}

// ── HTML processor ───────────────────────────────────────
async function processHTML(filePath) {
    const raw = await fs.readFile(filePath, "utf-8");

    // Dynamic import of cheerio
    const { load } = await import("cheerio");
    const $ = load(raw);

    $("script, style, nav, footer, header, aside").remove();
    const text = $("body").text().replace(/\s+/g, " ").trim();

    return {
        text: cleanText(text),
        pageCount: 1
    };
}

// ── Text cleaning ────────────────────────────────────────
function cleanText(text) {
    return text
        .replace(/\r\n/g, "\n")           // normalise line endings
        .replace(/\r/g, "\n")
        .replace(/\t/g, " ")              // tabs to spaces
        .replace(/\n{3,}/g, "\n\n")       // max 2 consecutive newlines
        .replace(/[ ]{2,}/g, " ")         // multiple spaces to single
        .replace(/[^\x20-\x7E\n]/g, " ") // remove non-ASCII
        .trim();
}