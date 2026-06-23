// utils/cache.js
import { logger } from "./logger.js";
import fs from "fs/promises";
import path from "path";

const CACHE_PATH = "cache.json";
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;  // 24 hours

let cache = {};

// Load cache from disk on startup
export async function loadCache() {
    try {
        const data = await fs.readFile(CACHE_PATH, "utf-8");
        cache = JSON.parse(data);
        // Remove expired entries
        const now = Date.now();
        let pruned = 0;
        for (const key of Object.keys(cache)) {
            if (now - cache[key].timestamp > CACHE_TTL_MS) {
                delete cache[key];
                pruned++;
            }
        }
        if (pruned > 0) {
            await saveCache();
            logger.info(`Cache pruned ${pruned} expired entries`);
        }
        logger.info(`Cache loaded: ${Object.keys(cache).length} entries`);
    } catch {
        cache = {};  // start fresh if no cache file
    }
}

// Save cache to disk
async function saveCache() {
    await fs.writeFile(CACHE_PATH, JSON.stringify(cache, null, 2));
}

// Generate a cache key from a search query
function cacheKey(query) {
    return query.toLowerCase().trim().replace(/\s+/g, "_").slice(0, 100);
}

// Get cached result
export function getCached(query) {
    const key = cacheKey(query);
    const entry = cache[key];
    if (!entry) return null;

    const age = Date.now() - entry.timestamp;
    if (age > CACHE_TTL_MS) {
        delete cache[key];
        return null;
    }

    const ageHrs = Math.round(age / 3600000);
    logger.info(`Cache HIT for "${query}" (${ageHrs}h old)`);
    return entry.result;
}

// Store result in cache
export async function setCached(query, result) {
    const key = cacheKey(query);
    cache[key] = { result, timestamp: Date.now(), query };
    await saveCache();
    logger.info(`Cache SET for "${query}"`);
}