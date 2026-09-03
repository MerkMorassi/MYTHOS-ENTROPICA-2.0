// js/core.js - MYTHOS CORE UTILITIES v1.6 (FINAL EXPORT FIX)

// --- NUMERICAL & VECTOR UTILITIES ---

export function cosineSim(a, b) {
    let dotProduct = 0, magnitudeA = 0, magnitudeB = 0;
    if (a.length !== b.length) return 0;
    for (let i = 0; i < a.length; i++) {
        dotProduct += a[i] * b[i];
        magnitudeA += a[i] * a[i];
        magnitudeB += b[i] * b[i];
    }
    magnitudeA = Math.sqrt(magnitudeA);
    magnitudeB = Math.sqrt(magnitudeB);
    return (magnitudeA === 0 || magnitudeB === 0) ? 0 : dotProduct / (magnitudeA * magnitudeB);
}

export function normalize(vec) {
    const mag = Math.sqrt(vec.reduce((s, v) => s + v*v, 0));
    return (!mag) ? vec.map(() => 0) : vec.map(v => v / mag);
}

export const VectorEngine = {
    search: (queryVector, loreNodes, limit = 8, threshold = 0.4) => {
        if (!queryVector || !loreNodes || !loreNodes.length) return [];
        const hits = loreNodes.map(node => ({
            ...node,
            score: cosineSim(queryVector, node.vector)
        }))
        .filter(node => node.score >= threshold)
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);
        return hits;
    }
};


// --- GEMINI API PROXY CLIENT ---

export async function apiCall(action, text, sysInst, apiKey, model) {
    // API and RCI calls use the Hypervisor port (4000)
    const response = await fetch('http://localhost:4000/api/gemini', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, text, sysInst, apiKey, model }),
    });

    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`Orchestrator Proxy Error: ${errorData.error || 'Server connection failed.'}`);
    }
    return response.json();
}


// --- CAS PROTOCOL CLIENT (VIRTUAL HYPERVISOR ROUTING) ---

export async function requestContext(agentPort, payload) {
  if (!agentPort) throw new Error("Agent port is required for Context Retrieval Interface (CRI).");
  
  // Route RCI to the Canonical Hypervisor Port (4000)
  const url = `http://localhost:4000/cas/proxy`; 
  
  const virtualPayload = {
      ...payload,
      targetPort: agentPort,
      targetAgentId: payload.agentId || 'UNKNOWN'
  };
  
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(virtualPayload)
    });
    
    if (!res.ok) {
        throw new Error(`CAS Hypervisor Error: ${res.status} ${res.statusText}`);
    }
    return res.json(); 
  } catch (e) {
      console.warn(`CAS RCI Warning: ${e.message}`);
      return { fragments: [] };
  }
}