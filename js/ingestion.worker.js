// js/ingestion.worker.js - BACKGROUND PROCESSOR
// Handles file parsing and embedding off the main thread.

import { apiCall } from './core.js';

// --- UTILITIES ---
function chunkText(text, targetSize = 600) {
    const chunks = []; let index = 0;
    while (index < text.length) {
        let limit = Math.min(index + targetSize, text.length);
        if (limit >= text.length) { chunks.push(text.slice(index)); break; }
        
        let splitIndex = -1;
        let searchStart = Math.max(index, limit - 100);
        
        // Try to split at paragraph or sentence
        splitIndex = text.lastIndexOf('\n', limit);
        if (splitIndex < searchStart) {
            const match = text.slice(searchStart, limit).match(/[.!?](\s|$)/); 
            if(match) splitIndex = searchStart + match.index + 1;
        }
        if (splitIndex < searchStart) splitIndex = text.lastIndexOf(' ', limit);
        if (splitIndex <= index) splitIndex = limit;

        const chunk = text.slice(index, splitIndex).trim();
        if (chunk.length > 0) chunks.push(chunk);
        index = splitIndex;
    }
    return chunks;
}

// --- EVENT LOOP ---
self.onmessage = async (event) => {
    const msg = event.data;
    if (msg.type === 'start') {
        await processFiles(msg.payload);
    }
};

async function processFiles(payload) {
    const { files, apiKey } = payload;
    let totalFiles = files.length;

    self.postMessage({ type: 'log', payload: { text: `Worker initialized. Processing ${totalFiles} files...`, author: 'sys' } });

    for (let i = 0; i < totalFiles; i++) {
        const file = files[i];
        
        try {
            // Read file (Standard Text)
            const text = await file.text(); 
            const chunks = chunkText(text);
            const vectorBatch = [];

            self.postMessage({ type: 'log', payload: { text: `Processing ${file.name} (${chunks.length} chunks)...`, author: 'sys' } });

            for (let c = 0; c < chunks.length; c++) {
                const chunkText = chunks[c];
                
                // Throttle (Worker is fast, but API limits apply)
                await new Promise(r => setTimeout(r, 80));

                try {
                    const res = await apiCall('embed', { text: chunkText }, apiKey);
                    
                    vectorBatch.push({
                        text: chunkText,
                        vector: res.embedding.values,
                        source: file.name
                    });

                    // Report Progress
                    const fileProgress = (c + 1) / chunks.length;
                    const totalProgress = ((i + fileProgress) / totalFiles) * 100;
                    
                    self.postMessage({ 
                        type: 'progress', 
                        payload: { percent: totalProgress, text: `${Math.floor(totalProgress)}%` } 
                    });

                } catch (e) {
                    // Retry or skip failed chunk
                    console.warn(`Chunk ${c} failed:`, e);
                }
            }

            // Send Batch to Main Thread
            if (vectorBatch.length > 0) {
                self.postMessage({ type: 'vectorsBatch', payload: vectorBatch });
            }

        } catch (e) {
            self.postMessage({ type: 'log', payload: { text: `Error reading ${file.name}: ${e.message}`, author: 'err' } });
        }
    }

    self.postMessage({ type: 'complete' });
}