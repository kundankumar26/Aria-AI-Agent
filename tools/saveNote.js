import fs from "fs/promises";
import path from "path";
import { addToVectorStore } from "../utils/vectorStore.js";

export const saveNoteTool = {
    type: "function",
    function: {
        name: "save_note",
        description: "Save completed research to the knowledge base as a markdown file and index it for future search.",
        parameters: {
            type: "object",
            properties: {
                title: {
                    type: "string",
                    description: "Descriptive title for the research note"
                },
                content: {
                    type: "string",
                    description: "Full research content to save in the note"
                }
            },
            required: ["title", "content"]
        }
    }
};

export async function save_note({ title, content }) {
    const filename = title.toLowerCase().replace(/[^a-z0-9]+/g, "-") + ".md";
    const filepath = path.join("research-notes", filename);
    const timestamp = new Date().toISOString();
    const fullText = `# ${title}\n_Saved: ${timestamp}_\n\n${content}`;

    // Save markdown file
    await fs.writeFile(filepath, fullText);

    // Update index
    const indexPath = "research-notes/index.json";
    const index = JSON.parse(await fs.readFile(indexPath, "utf-8"));
    const existing = index.findIndex(n => n.filename === filename);

    const entry = { title, filename, date: timestamp };
    if (existing >= 0) index[existing] = entry;
    else index.push(entry);

    await fs.writeFile(indexPath, JSON.stringify(index, null, 2));

    // Index into vector store
    await addToVectorStore({ filename, content: fullText });

    return `✅ Saved and indexed: "${title}"`;
}