import OpenAI from "openai";
import "dotenv/config";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export const summariseTool = {
    type: "function",
    function: {
        name: "summarise",
        description: "Condense a long piece of text into clear bullet points, preserving key facts and numbers. Use this to summarise long content from web pages or tool results before passing it to the agent.",
        parameters: {
            type: "object",
            properties: {
                text: {
                    type: "string",
                    description: "The long text to summarise, e.g. content returned from read_url or search results"
                },
                max_words: {
                    type: "number",
                    description: "Maximum words in the summary (default 150, recommended range 100–300)"
                }
            },
            required: ["text"]
        }
    }
};

export async function summarise({ text, max_words = 150 }) {
    try {
        const prompt = `Summarise the following text in clear bullet points (max ${max_words} words). Keep key facts and numbers.`;
        const truncatedText = text.slice(0, 6000);
        const response = await client.chat.completions.create({
            model: "gpt-4o-mini",    // cheaper model for simple task
            temperature: 1,
            max_tokens: Math.max(150, max_words * 2),
            messages: [
                {
                    role: "user",
                    content: `${prompt}\n\nText:\n${truncatedText}`
                }
            ]
        });

        return response.choices[0].message.content;

    } catch {
        // Fallback — return first 500 chars if LLM fails
        return text.slice(0, 500) + "... [full text unavailable]";
    }
}