const LOG_LEVELS = { silent: 0, error: 1, warn: 2, info: 3, debug: 4 };

const LEVEL = LOG_LEVELS[process.env.LOG_LEVEL || "info"];

export const logger = {

    error: (msg, data) => {
        if (LEVEL >= 1)
            console.error(`❌ [ERROR] ${msg}`, data ? JSON.stringify(data, null, 2) : "");
    },

    warn: (msg, data) => {
        if (LEVEL >= 2)
            console.warn(`⚠️  [WARN]  ${msg}`, data || "");
    },

    info: (msg, data) => {
        if (LEVEL >= 3)
            console.log(`ℹ️  [INFO]  ${msg}`, data || "");
    },

    debug: (msg, data) => {
        if (LEVEL >= 4)
            console.log(`🔍 [DEBUG] ${msg}`,
                data ? JSON.stringify(data, null, 2) : "");
    },

    // Log a full agent step — most useful for debugging
    step: (iteration, action, detail) => {
        if (LEVEL >= 3)
            console.log(`\n  [Step ${iteration}] ${action}`);
        if (LEVEL >= 4 && detail)
            console.log(`             ${detail}`);
    },

    // Log tool call + result
    tool: (name, args, result) => {
        if (LEVEL >= 3)
            console.log(`  🔧 ${name}(${JSON.stringify(args).slice(0, 80)})`);
        if (LEVEL >= 4)
            console.log(`     → ${String(result).slice(0, 150)}`);
    }
};