// js/chatpack-multi.js - MYTHOS LORECHAT ENGINE v2.4 (Final Manifest Trigger)

import { SimpleDB } from './mythos-db.js';
import { requestContext, apiCall } from './core.js'; 
import { RetrievalGate } from './retrieval-gate.js'; 

const DB = new SimpleDB();

export class ChatPackMulti {
    constructor(opts = {}) {
        this.activeAgentId = null;
        this.historyCache = {}; 
    }
    
    // --------------------
    // Agent Identity Management
    // --------------------

    async setActiveAgent(id) {
        if (!id) throw new Error('agentId required');
        await this._loadHistoryToCache(id); 
        this.activeAgentId = id;
    }

    async listAgents() {
        try {
            await DB.ready;
            
            // CRITICAL FIX: Trigger the manifest injection if DB is empty
            if (DB.ensureAgentsLoaded) {
                await DB.ensureAgentsLoaded();
            }

            const agents = await DB.getAll('agents');
            return agents || [];
        } catch (e) {
            console.error("MAGRAG: Identity Retrieval Failed:", e);
            return [];
        }
    }
    
    async getAgent(agentId) {
        await DB.ready;
        return DB.getById('agents', agentId) || null; 
    }

    // --------------------
    // History Management (IndexedDB)
    // --------------------
    
    async _loadHistoryToCache(agentId) {
        if (!agentId) return;
        try {
            const record = await DB.get('chat_history', agentId);
            this.historyCache[agentId] = record ? record.history : [];
        } catch (e) {
            console.error('Error loading history to cache:', e);
            this.historyCache[agentId] = [];
        }
    }

    loadHistory(agentId) {
        if (!agentId) return [];
        return this.historyCache[agentId] || [];
    }

    saveHistory(history) {
        if (!this.activeAgentId) return;
        this.historyCache[this.activeAgentId] = history;
        // Key path is 'id', so we must include it
        DB.put('chat_history', { id: this.activeAgentId, history: history }) 
          .catch(e => console.error('Error saving history to DB:', e));
    }

    async clearHistory(agentId) {
        if (!agentId) return;
        this.historyCache[agentId] = [];
        await DB.delete('chat_history', agentId);
        console.log(`History cleared for agent ${agentId}`);
    }


    // --------------------
    // MAGRAG GENERATION PIPELINE (Hypervisor-Gated)
    // --------------------
    
    async query(prompt, apiKey, agentIds) {
        const results = [];
        
        for (const agentId of agentIds) {
            try {
                const agentData = await this.getAgent(agentId);
                if (!agentData) {
                    results.push({ agentId, error: "Identity corruption: Agent not found." });
                    continue;
                }
                
                // --- CONTEXT BUILDING ---
                const conversationHistory = this.loadHistory(agentId);
                const historyContext = conversationHistory
                    .slice(-5) 
                    .map(m => `${m.role.toUpperCase()}: ${m.text}`)
                    .join('\n');

                // 1. GATING DECISION
                const gateDecision = RetrievalGate.evaluate(prompt, agentData);
                let contextBlock = "";
                let gateLog = `[GATE: ${gateDecision.strategy} | Reason: ${gateDecision.reason}]`;

                // 2. RETRIEVAL EXECUTION
                if (gateDecision.shouldRetrieve) {
                    try {
                        const contextResponse = await requestContext(agentData.port, {
                            query: prompt,
                            limit: 5,
                            threshold: 0.45,
                            agentId: agentData.id 
                        });

                        if (contextResponse && contextResponse.fragments && contextResponse.fragments.length > 0) {
                            const fragments = contextResponse.fragments;
                            contextBlock = fragments
                                .map(f => `[Source: ${f.source_ref || f.id}] ${f.text}`)
                                .join("\n\n");
                            contextBlock = `\n\n=== MAGRAG RETRIEVAL (GATED) ===\n${contextBlock}\n=== END RETRIEVAL ===`;
                        } else {
                            gateLog += " (RCI: No fragments found)";
                        }
                    } catch (rciError) {
                        console.warn(`RCI Offline/Failed for ${agentId}:`, rciError.message);
                        gateLog += " (RCI: Offline/Failed)";
                    }
                } else {
                    gateLog += " (Skipped RCI)";
                }
                
                // 3. PROMPT CONSTRUCTION
                const baseInstruction = agentData.system_instruction || "You are a helpful AI.";
                
                const finalPrompt = `
                    **Conversation History:**
                    ${historyContext}
                    
                    **User Query:**
                    ${prompt}
                `;

                // 4. GENERATION
                const responseData = await apiCall(
                    'generate', 
                    finalPrompt, 
                    `${baseInstruction}\n\nSYSTEM NOTE: ${gateLog}${contextBlock}`, 
                    apiKey, 
                    agentData.default_model || 'gemini-2.5-flash'
                );

                const text = responseData.candidates?.[0]?.content?.parts?.[0]?.text;
                results.push({ agentId, reply: text || JSON.stringify(responseData) });
                
            } catch (error) {
                results.push({ agentId, error: `MAGRAG FAILURE for ${agentId}: ${error.message}` });
            }
        }
        return results;
    }

    // --------------------
    // Export Functions
    // --------------------

    exportChatHistory(agentId, format) {
        const history = this.loadHistory(agentId);
        if (history.length === 0) {
            console.warn("Export failed: History is empty.");
            return;
        }

        let content;
        let mimeType;
        let extension;
        const filename = `${agentId}_session_${new Date().getTime()}`;

        if (format === 'json') {
            content = JSON.stringify(history, null, 2);
            mimeType = 'application/json';
            extension = '.json';
        } else { 
            content = history
                .map(m => `[${m.timestamp || 'N/A'}] ${m.role.toUpperCase()}: ${m.text}`)
                .join('\n\n');
            mimeType = 'text/plain';
            extension = '.txt';
        }

        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename + extension;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        console.log(`History for ${agentId} exported successfully to ${extension}.`);
    }
}

if (typeof window !== 'undefined') {
  window.ChatPackMulti = ChatPackMulti;
  window.cpm = new ChatPackMulti(); 
}