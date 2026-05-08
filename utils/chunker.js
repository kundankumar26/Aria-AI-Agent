// Split a document into overlapping chunks for embedding
export function chunkDocument(doc, chunkSize = 500, overlap = 50) {
    const words = doc.content.split(/\s+/);
    const chunks = [];

    for (let i = 0; i < words.length; i += chunkSize - overlap) {
        const slice = words.slice(i, i + chunkSize);
        // If this is the only chunk and it's short, still include it
        if (slice.length < 20 && chunks.length > 0) break;

        chunks.push({
            id: `${doc.filename}-${chunks.length}`,
            source: doc.filename,
            content: slice.join(" ")
        });

        if (i + chunkSize >= words.length) break;
    }

    return chunks;
}