// js/retrieval-gate.js - MYTHOS GATING LAYER v1.1 (Finalized)
// The "Sacred Contraction": Determines when to open the context floodgates.

export const RetrievalGate = {
    
    /**
     * Evaluates whether a query requires external context retrieval.
     * @param {string} query - The user's input.
     * @param {object} agent - The active agent's metadata.
     * @returns {{shouldRetrieve: boolean, strategy: string, reason: string}}
     */
    evaluate(query, agent) {
        if (!query || !agent || !agent.id) {
            return { shouldRetrieve: false, strategy: 'NONE', reason: 'Invalid Input' };
        }

        const q = query.toLowerCase().trim();
        const wordCount = q.split(/\s+/).length;

        // 1. HARD GATE: Null Agent or Quarantine Port
        if (agent.id === 'NULL' || agent.port === 4015) {
            return { shouldRetrieve: false, strategy: 'NONE', reason: 'Quarantine Protocol' };
        }

        // 2. IDENTITY GATE: Short greetings/phatic communication
        if (wordCount < 4 && !q.includes('?')) {
             if (['log', 'status', 'report', 'explain'].some(w => q.includes(w))) {
                 return { shouldRetrieve: true, strategy: 'RCI', reason: 'Command Detected' };
             }
             return { shouldRetrieve: false, strategy: 'NONE', reason: 'Conversational Phatic' };
        }

        // 3. INTENT GATE: Explicit recall keywords
        const recallTriggers = ['remember', 'recall', 'what did', 'last time', 'history', 'context', 'earlier', 'myth', 'lore'];
        if (recallTriggers.some(t => q.includes(t))) {
            return { shouldRetrieve: true, strategy: 'RCI', reason: 'Explicit Recall Intent' };
        }

        // 4. PERSONA GATE: Role-based defaults (Example: Historians check records)
        if (['CLIO', 'ARCHIVAX'].includes(agent.id.toUpperCase())) {
            return { shouldRetrieve: true, strategy: 'RCI', reason: 'Role Mandate: Historian/Archivist' };
        }
        
        // 5. DEFAULT GATE: Heuristic balance
        if (wordCount > 6) {
            // Complex queries are likely to require RAG
            return { shouldRetrieve: true, strategy: 'RCI', reason: 'Complex Query Heuristic' };
        }

        // Fallback: Closed Gate (Sacred Contraction)
        return { shouldRetrieve: false, strategy: 'NONE', reason: 'Default Contraction' };
    }
};