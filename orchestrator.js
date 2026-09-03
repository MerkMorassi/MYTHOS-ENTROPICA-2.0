// orchestrator.js - MYTHOS HYPERVISOR v3.4 (FINAL MODULE FIX + STATIC & LOREPACK)

import express from 'express'; // FIX: Replaced const express = require('express');
import bodyParser from 'body-parser'; // FIX: Replaced const bodyParser = require('body-parser');
import cors from 'cors'; // FIX: Replaced const cors = require('cors');
import fs from 'fs/promises';
import path from 'path';

const app = express();
const PORT = 4000; 
const VECTOR_STORE_PATH = path.join(process.cwd(), 'vector_store.json');

app.use(cors({ origin: '*' }));
app.use(bodyParser.json({ limit: '10mb' })); 

// CRITICAL FIX V2: Static File Serving (Required to load HTML/JS)
// This uses path.resolve to force the absolute path, preventing the "Cannot GET /" error.
app.use(express.static(path.resolve(process.cwd()))); 


// --- AI ENGINE (Gemini API) ---
async function callGeminiAPI(action, text, systemInstruction, apiKey, model = 'gemini-2.5-flash') {
    if (!apiKey || apiKey.startsWith('YOUR_')) throw new Error("Invalid API Key.");
    
    // Determine the API endpoint URL based on the action (embed or generate)
    const url = action === 'embed' 
        ? `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${apiKey}`
        : `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
        
    // Construct the payload for the API call
    const payload = action === 'embed'
        ? { model: 'text-embedding-004', content: { parts: text.map(t => ({ text: t })) }, task_type: 'RETRIEVAL_DOCUMENT' }
        : { contents: [{ parts: [{ text }] }], system_instruction: { parts: [{ text: systemInstruction || "" }] } };

    const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    if (!response.ok) throw new Error((await response.json()).error?.message || "API Error");
    return response.json();
}

// --- ROUTES ---

// 1. IDENTITY AUTHORITY
app.get('/agents/:agentId', async (req, res) => {
    try {
        const agentId = req.params.agentId.toLowerCase();
        const filePath = path.join(process.cwd(), 'agents', `agent.${agentId}.json`);
        await fs.access(filePath);
        res.json(JSON.parse(await fs.readFile(filePath, 'utf-8')));
    } catch {
        res.status(404).json({ error: "Identity not found" });
    }
});

// 2. VIRTUAL CAS PROXY (RCI Handler)
app.post('/cas/proxy', async (req, res) => {
    const { targetPort, targetAgentId, query } = req.body;
    
    console.log(`> [CAS] RCI Request for Virtual Agent ${targetAgentId} (Port ${targetPort}): "${query.substring(0, 40)}..."`);
    
    // TODO: Implement server-side vector retrieval here
    
    // Stub: Returns empty success to prevent client hanging
    res.json({ 
        revision: "virtual-stub",
        fragments: [] 
    });
});

// 3. LOREPACK INGESTION AUTHORITY
app.post('/lorepack/ingest/:agentId', async (req, res) => {
    const agentId = req.params.agentId;
    const nodes = req.body.nodes; 
    const apiKey = req.body.apiKey; 
    
    if (!nodes || !nodes.length || !apiKey) {
        return res.status(400).json({ error: "Invalid payload or missing API key." });
    }
    
    console.log(`> [LPS] Initiating LorePack Ingestion for Agent: ${agentId}. Nodes: ${nodes.length}`);
    
    try {
        // --- 1. EMBEDDING ---
        const textsToEmbed = nodes.map(n => n.text);
        
        // Use the Gemini API function for embedding
        const embeddingResponse = await callGeminiAPI('embed', textsToEmbed, null, apiKey);
        
        if (!embeddingResponse || !embeddingResponse.embeddings) {
             throw new Error("Embedding API failed to return data.");
        }

        const embeddedNodes = nodes.map((node, index) => {
            return {
                ...node,
                agentId: agentId, 
                vector: embeddingResponse.embeddings[index].values, 
                timestamp: new Date().toISOString()
            };
        });
        
        // --- 2. PERSISTENCE ---
        let vectorStore = {};
        try {
            vectorStore = JSON.parse(await fs.readFile(VECTOR_STORE_PATH, 'utf-8'));
        } catch {
            vectorStore = {}; 
        }

        vectorStore[agentId] = embeddedNodes;

        await fs.writeFile(VECTOR_STORE_PATH, JSON.stringify(vectorStore, null, 2));
        
        console.log(`> [LPS] Ingestion Complete. ${embeddedNodes.length} nodes stored in ${VECTOR_STORE_PATH}.`);

        res.json({ 
            status: 'SUCCESS', 
            count: embeddedNodes.length, 
            message: `LorePack for ${agentId} vectorized and stored.` 
        });

    } catch (e) {
        console.error(`LorePack Ingestion Failed for ${agentId}:`, e);
        res.status(500).json({ error: `Server-Side Ingestion Error: ${e.message}` });
    }
});

// 4. GENERATION PROXY
app.post('/api/gemini', async (req, res) => {
    try {
        const { action, text, sysInst, apiKey, model } = req.body;
        res.json(await callGeminiAPI(action, text, sysInst, apiKey, model));
    } catch (error) {
        console.error("Proxy Error:", error.message);
        res.status(500).json({ error: error.message });
    }
});

// --- SERVER START ---
app.listen(PORT, '0.0.0.0', () => {
    console.log(`MYTHOS HYPERVISOR ACTIVE on Canonical Port ${PORT}`);
    console.log(`> CAS Virtual Endpoint: /cas/proxy`);
    console.log(`> LorePack Endpoint: /lorepack/ingest/:agentId`);
});

export default app;