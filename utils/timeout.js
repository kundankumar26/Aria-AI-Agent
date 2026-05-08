// Wrap any async function with a timeout
export async function withTimeout(fn, ms = 10000) {
    return Promise.race([
        fn(),
        new Promise((_, reject) =>
            setTimeout(() => reject(new Error(`Timed out after ${ms}ms`)), ms)
        )
    ]);
}