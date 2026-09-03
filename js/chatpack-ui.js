// js/chatpack-ui.js - MYTHOS LORECHAT UI CONTROLLER v2.2 (Finalized for Hypervisor)

import { ChatPackMulti } from './chatpack-multi.js';

document.addEventListener('DOMContentLoaded', () => {
    // Initialize the engine. Pass { dom: false } to prevent the engine from trying to log to the UI directly.
    const cpm = new ChatPackMulti({ dom: false }); 
    let activeAgentId = null;
    let allAgents = [];
    let conversationHistory = []; // In-memory history for robustness

    // --- Virtual List Constants (Removed virtual list logic for simplicity) ---
    // const AGENT_ROW_HEIGHT = 36; 

    // --- DOM Element Cache ---
    const elements = {
        agentList: document.getElementById('agent-list'),
        fileInput: document.getElementById('file-input'),
        sendButton: document.getElementById('send-button'),
        messageInput: document.getElementById('message-input'),
        messagesContainer: document.getElementById('messages-container'),
        apiKeyInput: document.getElementById('apiKey'),
        keyStatus: document.getElementById('keyStatus'),
        clearClusterBtn: document.getElementById('clear-cluster-button'),
        activeAgentDisplay: document.getElementById('activeAgentDisplay'),
        agentHandleDisplay: document.getElementById('agentHandleDisplay'),
        vectorCount: document.getElementById('vectorCount'),
        orchestratorUrlInput: document.getElementById('orchestratorUrl'),
        lorepackFileTrigger: document.getElementById('lorepackFileTrigger'),
        modelDropdown: document.getElementById('modelDropdown'),
        sysInst: document.getElementById('sysInst'),
    };

    // --- Utilities ---
    function escapeHtml(unsafe) {
        return unsafe.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
    }

    // --- UI Rendering & Message Handling ---
    function appendMessage({ author = 'SYSTEM', text = '', type = 'system', id = null }, save = true) {
        const container = elements.messagesContainer;
        if (!container) return;

        const messageId = id || `msg-${Date.now()}-${Math.random().toString(16).slice(2)}`;
        const typeMap = { system: 'sys', error: 'err', ok: 'ok', bot: 'bot', user: 'user', thinking: 'sys' }; // thinking shows as sys
        const cssClass = typeMap[type] || 'sys';

        const wrapper = document.createElement('div');
        wrapper.className = `msg ${cssClass}`;
        wrapper.id = messageId;

        if (type === 'thinking') {
            wrapper.innerHTML = `> ${author}: <span class="thinking-indicator">${escapeHtml(text)}</span>`;
        } else if (cssClass === 'bot') {
            // Render agent response with simple markdown
            let content = escapeHtml(text)
                .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                .replace(/\*(.*?)\*/g, '<em>$1</em>')
                .replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>')
                .replace(/`([^`]+)`/g, '<code>$1</code>')
                .replace(/\n/g, '<br>');
            wrapper.innerHTML = `<strong>${author}:</strong> ${content}`;
        } else if (cssClass === 'user') {
            wrapper.innerHTML = `<div class="msg-content"><strong>YOU:</strong> ${escapeHtml(text)}</div>`;
        } else {
            wrapper.textContent = `> ${author}: ${escapeHtml(text)}`;
        }

        // Add Action Buttons (Copy/Edit)
        if (cssClass === 'user' || cssClass === 'bot') {
            const actions = document.createElement('div');
            actions.className = 'msg-actions';
            actions.style.marginTop = '4px';
            actions.style.fontSize = '0.8em';
            actions.style.opacity = '0.7';

            const copyBtn = document.createElement('span');
            copyBtn.textContent = ' [Copy] ';
            copyBtn.style.cursor = 'pointer';
            copyBtn.onclick = () => {
                navigator.clipboard.writeText(text);
                copyBtn.textContent = ' [Copied!] ';
                setTimeout(() => copyBtn.textContent = ' [Copy] ', 1500);
            };
            actions.appendChild(copyBtn);

            if (cssClass === 'user') {
                const editBtn = document.createElement('span');
                editBtn.textContent = ' [Edit] ';
                editBtn.style.cursor = 'pointer';
                editBtn.onclick = () => {
                    elements.messageInput.value = text;
                    elements.messageInput.focus();
                };
                actions.appendChild(editBtn);
            }
            wrapper.appendChild(actions);
        }

        container.appendChild(wrapper);
        container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });

        // Add to in-memory history if it's a persistent message type
        if ((cssClass === 'user' || cssClass === 'bot') && save) {
            if (!Array.isArray(conversationHistory)) conversationHistory = [];
            conversationHistory.push({ author, text, role: cssClass === 'user' ? 'user' : 'bot', timestamp: new Date().toISOString() });
            cpm.saveHistory(conversationHistory); // The engine uses activeAgentId internally
        }
        return messageId;
    }

    function removeMessage(id) {
        if (!id) return;
        const messageElement = document.getElementById(id);
        if (messageElement) messageElement.remove();
    }

    function renderVisibleAgents() {
        // Simple render of all agents, replacing the complex virtual list logic
        elements.agentList.innerHTML = '';
        allAgents.forEach(agent => {
            const item = document.createElement('div');
            item.className = 'agent-item';
            item.setAttribute('data-agent-id', agent.id);
            item.innerHTML = `
                <div class="agent-handle">${agent.handle || agent.id.toUpperCase()}</div>
                <div class="agent-role">${agent.persona_attributes?.role || 'AGENT'}</div>
            `;
            if (agent.id === activeAgentId) {
                item.classList.add('active');
            }
            elements.agentList.appendChild(item);
        });
    }

    // --- State & History Management ---
    async function setActiveAgent(agentId) {
        if (activeAgentId && activeAgentId !== agentId) {
            // History saving is now done within appendMessage, but this ensures a final save on switch
            cpm.saveHistory(conversationHistory); 
        }

        try {
            await cpm.setActiveAgent(agentId);
            const agent = await cpm.getAgent(agentId); // Re-fetch for updated info
            if (!agent) throw new Error(`Agent data not found for ${agentId}`);

            activeAgentId = agent.id;
            
            // Update UI
            elements.activeAgentDisplay.textContent = `// ${agent.handle || agent.id} ONLINE`;
            elements.agentHandleDisplay.textContent = agent.handle || agent.id;
            
            // FIX: Vector count is now remote. Reflect this in the UI.
            elements.vectorCount.textContent = 'REMOTE (via RCI)';

            // Load and render history
            loadAndRenderHistory(agent);

            renderVisibleAgents(); // Re-render to highlight the new active agent
            localStorage.setItem('mythos_last_active_agent', activeAgentId);

        } catch (e) {
            appendMessage({ text: `Failed to set active agent ${agentId}: ${e.message}`, type: 'error' }, false);
        }
    }

    function loadAndRenderHistory(agent) {
        elements.messagesContainer.innerHTML = ''; // Clear display
        const loaded = cpm.loadHistory(agent.id);
        conversationHistory = Array.isArray(loaded) ? loaded : [];

        if (conversationHistory.length > 0) {
            conversationHistory.forEach(msg => {
                // Re-render messages from the loaded history without re-saving
                appendMessage({ author: msg.author, text: msg.text || msg.content, type: msg.role }, false);
            });
            appendMessage({ text: `History loaded for ${agent.handle}.`, type: 'ok' }, false);
        } else {
            appendMessage({ text: `Console ready for ${agent.handle}.`, type: 'system' }, false);
        }
    }

    async function updateAndRenderAgentList() {
        try {
            allAgents = await cpm.listAgents();
            renderVisibleAgents();
            return allAgents;
        } catch (e) {
            appendMessage({ text: `Failed to load agent list: ${e.message}. Hypervisor or DB failure.`, type: 'error' }, false);
            return [];
        }
    }
    
    // --- API & Orchestrator ---
    async function doSend() {
        const text = elements.messageInput.value.trim();
        if (!text) return;

        elements.sendButton.disabled = true;
        elements.messageInput.disabled = true;

        if (!activeAgentId) {
            appendMessage({ author: 'SYSTEM', text: 'No active agent selected.', type: 'error' });
            elements.sendButton.disabled = false;
            elements.messageInput.disabled = false;
            return;
        }

        const agent = await cpm.getAgent(activeAgentId);
        appendMessage({ author: 'YOU', text, type: 'user' });
        elements.messageInput.value = '';

        
        const thinkingId = appendMessage({
            author: agent.handle || agent.id,
            text: 'is consulting the Sacred Contraction...',
            type: 'thinking'
        }, false);

        try {
            // FIX: Use the correct, fixed query method supporting Gating/RCI/Multi-Agent signature
            const results = await cpm.query(
                text, 
                elements.apiKeyInput.value, 
                [activeAgentId] // Query only the active agent (One-to-One mode)
            );
            
            removeMessage(thinkingId);

            // Process results (should only be one)
            const result = results[0];
            const authorHandle = agent.handle || result.agentId || 'ORCHESTRATOR';
            
            if (result.error) {
                 appendMessage({ author: authorHandle, text: `FAILURE: ${result.error}`, type: 'error' });
            } else {
                const replyText = result.reply || 'No reply was generated.';
                appendMessage({ author: authorHandle, text: replyText, type: 'bot' });
            }

        } catch (err) {
            removeMessage(thinkingId);
            appendMessage({ author: 'SYSTEM', text: `Agent Query Failure (Hypervisor): ${err.message}`, type: 'error' });
        } finally {
            elements.sendButton.disabled = false;
            elements.messageInput.disabled = false;
            elements.messageInput.focus();
        }
    }

    // --- Event Listeners ---
    async function initialize() {
        // API Key
        const storedKey = sessionStorage.getItem('mythos_api_key');
        if (storedKey) {
            elements.apiKeyInput.value = storedKey;
            elements.keyStatus.textContent = '[ KEY LOADED ]';
        }
        elements.apiKeyInput.addEventListener('input', () => {
            sessionStorage.setItem('mythos_api_key', elements.apiKeyInput.value);
            elements.keyStatus.textContent = elements.apiKeyInput.value ? '[ KEY LOADED ]' : '[ KEY UNLOADED ]';
        });

        // Orchestrator URL (Now deprecated, but kept for legacy setting storage)
        const savedUrl = localStorage.getItem('mythos_orchestrator_url');
        if (savedUrl) elements.orchestratorUrlInput.value = savedUrl;
        elements.orchestratorUrlInput.addEventListener('change', () => localStorage.setItem('mythos_orchestrator_url', elements.orchestratorUrlInput.value));

        // Send button
        elements.sendButton.addEventListener('click', doSend);
        elements.messageInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); doSend(); }
        });

        // Agent List event delegation for clicks
        elements.agentList.addEventListener('click', (e) => {
            const agentItem = e.target.closest('.agent-item');
            if (!agentItem) return;
            const agentId = agentItem.dataset.agentId;
            setActiveAgent(agentId);
        });

        // FIX: Remove broken LorePack Import logic entirely
        // elements.lorepackFileTrigger.addEventListener('click', ...); // REMOVED
        // elements.fileInput.addEventListener('change', ...); // REMOVED
        // Update the button text to reflect its new, neutral status
        elements.lorepackFileTrigger.textContent = "LOREPACK ACCESS (use LOREPACK tool)";
        elements.lorepackFileTrigger.style.background = '#222';
        elements.lorepackFileTrigger.style.color = '#ccc';


        // Cluster Clear
        elements.clearClusterBtn.addEventListener('click', async () => {
            if (activeAgentId && confirm(`Purge history ONLY for ${activeAgentId}?`)) {
                await cpm.clearHistory(activeAgentId);
                conversationHistory = [];
                loadAndRenderHistory(await cpm.getAgent(activeAgentId));
                appendMessage({ text: `History purged for ${activeAgentId}.`, type: 'ok' });
            } else if (confirm('Purge ALL agents and ALL history?')) {
                // The ChatPackMulti v2.1 no longer has a safe clearAllAgents. We'll simulate a simple clear.
                // NOTE: A more robust clearAllAgents should be implemented in the future.
                await cpm.db.clear('agents');
                await cpm.db.clear('chat_history');
                conversationHistory = [];
                activeAgentId = null;
                elements.messagesContainer.innerHTML = '';
                appendMessage({ text: 'All agent data purged.', type: 'ok' });
                await updateAndRenderAgentList(); 
            }
        });

        // Initial Render
        await updateAndRenderAgentList();
        if (allAgents && allAgents.length > 0) {
            const lastAgentId = localStorage.getItem('mythos_last_active_agent');
            const agentToLoad = allAgents.find(a => a.id === lastAgentId) || allAgents[0];
            if (agentToLoad) {
                await setActiveAgent(agentToLoad.id);
            }
        } else {
             appendMessage({ text: 'Console Ready. Import agents using the LOREPACK tool.', type: 'system' });
        }

        window.addEventListener('beforeunload', () => {
            if (activeAgentId) cpm.saveHistory(conversationHistory); // Final save on window close
        });
    }

    initialize().catch(e => appendMessage({ text: `Initialization Failure: ${e.message}`, type: 'error' }));
});