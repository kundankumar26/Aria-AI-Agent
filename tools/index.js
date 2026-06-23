// Single import point for all tools

import { getCurrentDateTool, get_current_date } from "./getCurrentDate.js";
import { searchWebTool, search_web } from "./searchWeb.js";
import { readUrlTool, read_url } from "./readUrl.js";
import { searchKnowledgeBaseTool, search_knowledge_base } from "./searchKnowledgeBase.js";
import { saveNoteTool, save_note } from "./saveNote.js";
import { summariseTool, summarise } from "./summarise.js";
import { morningBriefingTool, get_morning_briefing } from "./briefing.js";
import { get_weather, weatherTool } from "./weather.js";
import {
    searchDocumentsTool, search_documents,
    listDocumentsTool, list_documents,
    getDocumentSummaryTool, get_document_summary
} from "./documents.js";

// All tool descriptions → sent to LLM
export const toolDefinitions = [
    getCurrentDateTool,
    searchKnowledgeBaseTool,   // listed before searchWeb — use KB first
    searchWebTool,
    readUrlTool,
    summariseTool,
    saveNoteTool,
    morningBriefingTool,
    weatherTool,
    searchDocumentsTool,
    listDocumentsTool,
    getDocumentSummaryTool
];

// All tool functions → called by agent loop
export const toolFunctions = {
    get_current_date,
    search_knowledge_base,
    search_web,
    read_url,
    summarise,
    save_note,
    get_morning_briefing,
    get_weather,
    search_documents,
    list_documents,
    get_document_summary
};