import { SimpleDB, apiCall } from './core.js';

const DB = new SimpleDB();
const $ = (id) => document.getElementById(id);

const state = {
    agent: null,
    apiKey: localStorage.getItem('mythos_api_key') || '',
    files: [],
    editor: {
        nodes: [],
        filteredNodes: [],
        currentPage: 1,
        itemsPerPage: 5
    },
    ingestionAbortController: null,
    isPaused: false,
    pausePromise: null,
    resumePromise: null
};

// Init
if (state.apiKey) $('apiKey').value = state.apiKey;
updateStatus();

function log(msg, type = 'info') {
    const box = $('systemLog');
    const el = document.createElement('div');
    el.style.color = type === 'error' ? 'var(--error-color)' : type === 'ok' ? 'var(--accent-color)' : '#888';
    el.innerHTML = `<span style="opacity:0.5">[${new Date().toLocaleTimeString()}]</span> ${msg}`;
    box.prepend(el);
}

function updateStatus() {
    $('apiStatus').textContent = state.apiKey ? '[ KEY LOADED ]' : '[ KEY MISSING ]';
    $('apiStatus').className = state.apiKey ? 'status-tag status-ok' : 'status-tag status-err';
    $('statusIndicator').textContent = state.agent ? `TARGET: ${state.agent.handle}` : 'SYSTEM READY';
}

window.LOREPACK = {
    saveKey: (val) => {
        state.apiKey = val.trim();
        localStorage.setItem('mythos_api_key', state.apiKey);
        updateStatus();
    },

    loadAgentByHandle: async () => {
        const handle = $('agentHandle').value.trim().toUpperCase();
        if (!handle) return log('Enter an Agent Handle.', 'error');

        try {
            const agents = await DB.getAll('agents');
            const target = agents.find(a => a.handle === handle);
            
            if (target) {
                state.agent = target;
                $('agentStatus').textContent = "CONNECTED";
                $('agentStatus').style.color = "var(--accent-color)";
                log(`Agent ${handle} Loaded. ID: ${target.id}`, 'ok');
                
                // Load existing vectors count
                const vectors = await DB.getAll('vectors');
                const agentVectors = vectors.filter(v => v.agentId === target.id);
                $('vectorCount').textContent = agentVectors.length;
                
                updateStatus();
                window.LOREPACK.refreshManifest();
            } else {
                log(`Agent ${handle} not found in DB.`, 'error');
                $('agentStatus').textContent = "NOT FOUND";
                $('agentStatus').style.color = "var(--error-color)";
            }
        } catch (e) {
            log(`DB Error: ${e.message}`, 'error');
        }
    },

    handleDragOver: (e) => { e.preventDefault(); $('dropZone').classList.add('dragover'); },
    handleDragLeave: (e) => { $('dropZone').classList.remove('dragover'); },
    handleDrop: (e) => {
        e.preventDefault();
        $('dropZone').classList.remove('dragover');
        window.LOREPACK.ingestLoreFile(e.dataTransfer.files);
    },

    ingestLoreFile: async (files) => {
        if (!state.agent) return log('Load Target Agent first.', 'error');
        if (!state.apiKey) return log('API Key required for embedding.', 'error');

        const fileList = Array.from(files);
        if (fileList.length === 0) return;

        state.ingestionAbortController = new AbortController();
        const signal = state.ingestionAbortController.signal;

        // Reset pause state
        state.isPaused = false;
        if (state.resumePromise) state.resumePromise();
        $('pauseResumeBtn').textContent = '[ PAUSE ]';
        $('pauseResumeBtn').style.color = '#f0ad4e';

        $('ingestStatus').style.display = 'block';
        const bar = $('ingestBar');
        const pct = $('ingestPercent');

        let processed = 0;
        const total = fileList.length;

        try {
            for (const file of fileList) {
                if (signal.aborted) throw new Error('Cancelled');
                if (state.isPaused) {
                    log('Ingestion paused...');
                    await state.pausePromise;
                    log('Ingestion resumed.');
                }
            try {
                log(`Processing ${file.name}...`);
                const text = await file.text();
                
                // Chunking
                const chunks = text.match(/[\s\S]{1,1000}/g) || []; // Simple chunking
                
                for (let i = 0; i < chunks.length; i++) {
                    if (state.isPaused) {
                        log('Ingestion paused...');
                        await state.pausePromise;
                        log('Ingestion resumed.');
                    }
                    if (signal.aborted) throw new Error('Cancelled');
                    const chunk = chunks[i];
                    // Embed
                    const res = await apiCall('embed', { text: chunk }, state.apiKey);
                    const vector = res.embedding.values;

                    const record = {
                        id: crypto.randomUUID(),
                        agentId: state.agent.id,
                        source: file.name,
                        text: chunk,
                        vector: vector,
                        timestamp: new Date().toISOString()
                    };

                    await DB.put('vectors', record);

                    // Update progress per chunk
                    const chunkProgress = (i + 1) / chunks.length;
                    const overallProgress = ((processed + chunkProgress) / total) * 100;
                    const p = Math.round(overallProgress);
                    bar.style.width = `${p}%`;
                    pct.textContent = `${p}%`;
                }
                
                log(`Ingested ${file.name} (${chunks.length} chunks).`, 'ok');
            } catch (e) {
                if (e.message === 'Cancelled') throw e;
                log(`Failed ${file.name}: ${e.message}`, 'error');
            }
            
            processed++;
            const p = Math.round((processed / total) * 100);
            bar.style.width = `${p}%`;
            pct.textContent = `${p}%`;
            }
        } catch (e) {
            if (e.message === 'Cancelled') log('Ingestion cancelled by user.', 'error');
        } finally {
            state.ingestionAbortController = null;
            state.isPaused = false;
            if (state.resumePromise) state.resumePromise();
        }

        // Refresh UI
        const vectors = await DB.getAll('vectors');
        const agentVectors = vectors.filter(v => v.agentId === state.agent.id);
        $('vectorCount').textContent = agentVectors.length;
        window.LOREPACK.refreshManifest();
        
        if ($('ingestStatus').style.display === 'block') {
            setTimeout(() => { $('ingestStatus').style.display = 'none'; }, 2000);
        }
    },

    cancelIngestion: () => {
        if (state.ingestionAbortController) {
            if (state.isPaused) {
                state.isPaused = false;
                if (state.resumePromise) state.resumePromise();
            }
            state.ingestionAbortController.abort();
        }
    },

    toggleIngestionPause: () => {
        if (!state.ingestionAbortController) return;

        state.isPaused = !state.isPaused;
        const button = $('pauseResumeBtn');

        if (state.isPaused) {
            button.textContent = '[ RESUME ]';
            button.style.color = 'var(--accent-color)';
            log('Ingestion paused.', 'info');
            state.pausePromise = new Promise(resolve => { state.resumePromise = resolve; });
        } else {
            button.textContent = '[ PAUSE ]';
            button.style.color = '#f0ad4e';
            log('Ingestion resumed.', 'info');
            if (state.resumePromise) { state.resumePromise(); }
        }
    },

    refreshManifest: async () => {
        if (!state.agent) return;
        const vectors = await DB.getAll('vectors');
        const agentVectors = vectors.filter(v => v.agentId === state.agent.id);
        
        // Group by source
        const sources = [...new Set(agentVectors.map(v => v.source))];
        const list = $('fileManifest');
        list.innerHTML = '';
        
        if (sources.length === 0) {
            list.innerHTML = '<li style="padding:10px; color:#666;">No Lore Files Ingested.</li>';
            return;
        }

        sources.forEach(src => {
            const count = agentVectors.filter(v => v.source === src).length;
            const li = document.createElement('li');
            li.className = 'file-item';
            li.innerHTML = `
                <span>${src} <span style="color:#666">(${count} nodes)</span></span>
                <div>
                    <button style="background:none; border:none; color:var(--accent-color); cursor:pointer; margin-right:10px; font-size:0.8em;" onclick="window.LOREPACK.viewSource('${src}')">EDIT</button>
                    <button class="delete-btn" onclick="window.LOREPACK.deleteSource('${src}')">×</button>
                </div>
            `;
            list.appendChild(li);
        });
    },

    deleteSource: async (source) => {
        if (!confirm(`Delete all vectors from ${source}?`)) return;
        const vectors = await DB.getAll('vectors');
        const toDelete = vectors.filter(v => v.agentId === state.agent.id && v.source === source);
        
        for (const v of toDelete) {
            await DB.delete('vectors', v.id);
        }
        
        log(`Deleted ${toDelete.length} nodes from ${source}.`, 'ok');
        
        // Update counts
        const all = await DB.getAll('vectors');
        const agentVectors = all.filter(v => v.agentId === state.agent.id);
        $('vectorCount').textContent = agentVectors.length;
        
        window.LOREPACK.refreshManifest();
    },

    purgeAllVectors: async () => {
        if (!state.agent) return;
        if (!confirm(`WARNING: Delete ALL ${state.agent.handle} memory nodes?`)) return;
        
        const vectors = await DB.getAll('vectors');
        const toDelete = vectors.filter(v => v.agentId === state.agent.id);
        
        for (const v of toDelete) {
            await DB.delete('vectors', v.id);
        }
        
        log(`Purged ${toDelete.length} nodes.`, 'ok');
        $('vectorCount').textContent = '0';
        window.LOREPACK.refreshManifest();
    },

    exportLorePack: async () => {
        if (!state.agent) return log('Load Agent first.', 'error');
        
        const vectors = await DB.getAll('vectors');
        const agentVectors = vectors.filter(v => v.agentId === state.agent.id);
        
        if (agentVectors.length === 0) return log('No data to export.', 'error');

        const pack = {
            header: {
                handle: state.agent.handle,
                role: state.agent.role,
                exported: new Date().toISOString(),
                version: "1.0"
            },
            sacred_archive: agentVectors
        };

        const blob = new Blob([JSON.stringify(pack, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `LOREPACK_${state.agent.handle}_${Date.now()}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        log(`LorePack Exported: ${agentVectors.length} nodes.`, 'ok');
    },

    importLorePack: async (files) => {
        const file = files[0];
        if (!file) return;

        try {
            const text = await file.text();
            const data = JSON.parse(text);

            if (!data.header || !data.sacred_archive) {
                throw new Error("Invalid LorePack format.");
            }

            // 1. Restore Agent Metadata
            // We infer the ID from the first vector if possible, or generate one if missing (legacy support)
            const vectors = data.sacred_archive;
            const agentId = vectors.length > 0 ? vectors[0].agentId : crypto.randomUUID();

            const agent = {
                id: agentId,
                handle: data.header.handle,
                role: data.header.role
            };

            await DB.put('agents', agent);

            // 2. Restore Vectors
            for (const v of vectors) {
                await DB.put('vectors', v);
            }

            // 3. Load into UI
            $('agentHandle').value = agent.handle;
            window.LOREPACK.loadAgentByHandle(); // This will refresh the manifest and counts
            log(`Imported LorePack: ${agent.handle} (${vectors.length} nodes).`, 'ok');

        } catch (e) {
            log(`Import Failed: ${e.message}`, 'error');
        }
    },

    viewSource: async (source) => {
        const vectors = await DB.getAll('vectors');
        const nodes = vectors.filter(v => v.agentId === state.agent.id && v.source === source);
        
        const searchInput = $('nodeSearch');
        if (searchInput) searchInput.value = '';

        // Initialize Editor State
        state.editor.nodes = nodes;
        state.editor.filteredNodes = [...nodes];
        state.editor.currentPage = 1;

        window.LOREPACK.renderEditorPage();
        $('nodeEditor').style.display = 'flex';
    },

    renderEditorPage: () => {
        const container = $('nodeList');
        container.innerHTML = '';
        
        const start = (state.editor.currentPage - 1) * state.editor.itemsPerPage;
        const end = start + state.editor.itemsPerPage;
        const pageNodes = state.editor.filteredNodes.slice(start, end);
        
        pageNodes.forEach(node => {
            const div = document.createElement('div');
            div.style.cssText = 'border:1px solid #333; padding:15px; background:#111;';
            div.innerHTML = `
                <div style="margin-bottom:10px; font-size:0.75em; color:#666; font-family:monospace;">ID: ${node.id}</div>
                <textarea id="text-${node.id}" style="width:100%; height:100px; background:#000; color:#ccc; border:1px solid #333; padding:10px; font-family:monospace; resize:vertical;">${node.text}</textarea>
                <div style="text-align:right; margin-top:10px;">
                    <button onclick="window.LOREPACK.updateNode('${node.id}')" style="cursor:pointer; background:var(--accent-color); color:#000; border:none; padding:8px 15px; font-weight:bold; font-size:0.8em;">RE-EMBED & SAVE</button>
                </div>
            `;
            container.appendChild(div);
        });

        // Update Pagination Controls
        const totalPages = Math.ceil(state.editor.filteredNodes.length / state.editor.itemsPerPage) || 1;
        $('pageInfo').textContent = `Page ${state.editor.currentPage} of ${totalPages}`;
        $('prevPage').disabled = state.editor.currentPage === 1;
        $('nextPage').disabled = state.editor.currentPage >= totalPages;
        $('prevPage').style.opacity = state.editor.currentPage === 1 ? '0.5' : '1';
        $('nextPage').style.opacity = state.editor.currentPage >= totalPages ? '0.5' : '1';
    },

    changePage: (delta) => {
        const totalPages = Math.ceil(state.editor.filteredNodes.length / state.editor.itemsPerPage) || 1;
        const newPage = state.editor.currentPage + delta;
        if (newPage >= 1 && newPage <= totalPages) {
            state.editor.currentPage = newPage;
            window.LOREPACK.renderEditorPage();
        }
    },

    updateNode: async (id) => {
        const newText = $(`text-${id}`).value;
        if (!newText.trim()) return alert('Text cannot be empty');
        if (!state.apiKey) return alert('API Key required to re-embed.');
        
        try {
            log(`Re-embedding node...`);
            const res = await apiCall('embed', { text: newText }, state.apiKey);
            const node = await DB.get('vectors', id);
            if (node) {
                node.text = newText;
                node.vector = res.embedding.values;
                node.timestamp = new Date().toISOString();
                await DB.put('vectors', node);
                
                // Update local state to persist changes across page turns
                const localNode = state.editor.nodes.find(n => n.id === id);
                if (localNode) { localNode.text = newText; localNode.vector = node.vector; }
                
                log(`Node updated successfully.`, 'ok');
            }
        } catch (e) {
            log(`Update failed: ${e.message}`, 'error');
        }
    },

    filterNodes: (query) => {
        const term = query.toLowerCase();
        state.editor.filteredNodes = state.editor.nodes.filter(node => 
            node.text.toLowerCase().includes(term)
        );
        state.editor.currentPage = 1;
        window.LOREPACK.renderEditorPage();
    }
};