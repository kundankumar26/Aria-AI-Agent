import fetch from "node-fetch";
import * as cheerio from "cheerio";

export const readUrlTool = {
    type: "function",
    function: {
        name: "read_url",
        description: "Fetch a webpage and extract its main readable text content, removing ads, navigation, and other noise. Returns the cleaned text from the page.",
        parameters: {
            type: "object",
            properties: {
                url: {
                    type: "string",
                    description: "The full URL to read"
                }
            },
            required: ["url"]
        }
    }
};

export async function read_url({ url }) {
    let response;
    try {
        response = await fetch(url, {
            headers: {
                "User-Agent": "Mozilla/5.0 (compatible; ResearchBot/1.0)"
            }
        });
    } catch (err) {
        return `Could not fetch ${url}: ${err.message}`;
    }

    if (!response.ok) {
        if (response.status === 404) {
            return `Could not fetch ${url}: 404 Not Found.`;
        }
        return `Could not fetch ${url}: ${response.status} ${response.statusText}`;
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    // Remove noise
    $("script, style, nav, footer, header, aside, .ads, #ads").remove();

    // Extract clean text
    const text = $("article, main, .content, body")
        .first()
        .text()
        .replace(/\s+/g, " ")
        .trim();

    if (text.length < 100) {
        return `Could not extract content from ${url}. \n Page may require JavaScript or login.`;
    }

    return text;
}