// Retry any async function with exponential backoff
export async function withRetry(fn, options = {}) {
    const {
        maxAttempts = 3,
        delayMs = 1000,
        backoff = 2
    } = options;

    let lastError;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            return await fn();
        } catch (error) {
            lastError = error;
            console.warn(`  ⚠️  Attempt ${attempt}/${maxAttempts} failed: ${error.message}`);

            if (attempt < maxAttempts) {
                const wait = delayMs * Math.pow(backoff, attempt - 1);
                await new Promise(r => setTimeout(r, wait));
            }
        }
    }

    throw new Error(`Failed after ${maxAttempts} attempts: ${lastError.message}`);
}