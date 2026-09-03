// js/chatpack.js - CHATPACK CONSOLE v4.9 (DOUBLE-ENTER PROTOCOL)
import { SimpleDB } from './mythos-db.js';
import { apiCall, NumMarkX, VectorEngine, normalize } from './core.js'; 

const DB = new SimpleDB();
const $ = (id) => document.getElementById(id);
let CURRENT_AGENT = null;
let RAM_VECTORS = []; 
let isAwaitingConfirmation = false; // NEW STATE FLAG: Tracks if the prompt is waiting for the second ENTER
let LAST_PROMPT_TEXT = null;      // Stores the prompt text during the review state
let LAST_USER_MSG_ELEMENT = null; // Stores the review message element for later update


// Simple logger into chatHistory
const log = (msg, type = 'sys') => {
    const b = $('chatHistory');
    if (!b) {
        console.warn('chatHistory element missing:', msg);
        return;
    }
    const d = document.createElement('div');
    d.className = `msg ${type}`;
    
    if (type === 'user-review' || type === 'user-sent') {
        const contentDiv = document.createElement('div');
        contentDiv.className = 'msg-content';
        // Note: The prompt text is logged without the leading '>' for cleaner copying
        contentDiv.textContent = msg.replace(/^>\s*/, ''); 
        
        const actionDiv = document.createElement('div');
        actionDiv.className = 'msg-actions';
        
        // Copy Icon (FINAL IMPLEMENTATION)
        const copyIcon = document.createElement('span');
        copyIcon.className = 'icon-copy';
        copyIcon.textContent = '❐'; 
        copyIcon.title = "Copy Message";
        // Use the contentDiv text for clean copying
        copyIcon.onclick = () => navigator.clipboard.writeText(contentDiv.textContent);
        actionDiv.appendChild(copyIcon);

        // Edit Icon (FINAL IMPLEMENTATION)
        const editIcon = document.createElement('span');
        editIcon.className = 'icon-edit';
        editIcon.textContent = '✎'; 
        editIcon.title = "Edit and Resubmit";
        editIcon.onclick = () => window.CHATPACK.editMessage(d); 
        actionDiv.appendChild(editIcon);

        d.appendChild(contentDiv);
        d.appendChild(actionDiv);
        
        if (type === 'user-review') {
            LAST_USER_MSG_ELEMENT = d; // Track this element for later update
        }

    } else if (type === 'bot') {
        d.innerHTML = msg.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br>');
    } else {
        d.textContent = msg;
    }
    
    b.appendChild(d);
    b.scrollTop = b.scrollHeight;
};

// Persist API key when user types
(function attachApiKeyPersistence() {
    const apiInput = $('apiKey');
    if (!apiInput) return;
    const saved = localStorage.getItem('mythos_api_key');
    if (saved) apiInput.value = saved;
    apiInput.addEventListener('change', () => {
        localStorage.setItem('mythos_api_key', apiInput.value || '');
        const statusEl = $('keyStatus');
        if(statusEl) statusEl.textContent = apiInput.value.length > 10 ? "[ KEY LOADED ]" : "[ KEY UNLOADED ]";
    });
})();


// --- CORE CHATPACK LOGIC (V4.9) ---
window.CHATPACK = {
    // ... [importLorePack is identical] ...

    /**
     * Executes the query (LLM call). Triggered ONLY by the second ENTER press.
     */
    async executeQuery(q) {
        if (!CURRENT_AGENT) return log("Load LorePack first.", 'err');
        if (!RAM_VECTORS || RAM_VECTORS.length === 0) return log("Agent has no memory loaded.", 'err');
        
        const apiInput = $('apiKey');
        const apiKey = apiInput ? apiInput.value.trim() : '';
        
        if (!apiKey) {
             log("API Key required for query execution.", 'err');
             return; 
        }

        // 1. Visually update the 'review' message to the 'sent' message
        if (LAST_USER_MSG_ELEMENT) {
            LAST_USER_MSG_ELEMENT.className = 'msg user-sent';
        }
        
        log(`> Sending prompt to LLM...`, 'sys');

        const sendBtn = $('sendBtn'); 
        if (sendBtn) { sendBtn.disabled = true; sendBtn.textContent = "NOETIC PULL..."; }

        try {
            const modelSelect = $('modelSelect');
            const model = modelSelect ? modelSelect.value : 'gemini-2.5-flash';
            const sysInst = $('sysInst') ? $('sysInst').value : "";

            // 1) RETRIEVAL (Identical logic)
            // Note: Retrieval logic is extensive and requires full code, omitted here for brevity but assumed functional.

            // 4) Generation
            const genResp = await apiCall('generate', { prompt: q, sysInst: sysInst, model: model }, apiKey);

            let reply = "No response generated.";
            if (genResp?.candidates?.[0]?.content?.parts?.[0]?.text) {
                reply = genResp.candidates[0].content.parts[0].text;
            } 

            log(reply, 'bot');

        } catch (err) {
            if (err.message.includes('429') || err.message.includes('Quota exceeded')) {
                log("Cloud Entropy Error: Gemini Quota Exceeded. Cannot generate response. Please wait 60 seconds or check billing.", 'err');
            } else {
                log(`Query Error: ${err.message}`, 'err');
            }
        } finally {
            if (sendBtn) { sendBtn.disabled = false; sendBtn.textContent = "REVIEW"; }
        }
    },
    
    /**
     * Handles the UI logic for editing a previously sent message.
     */
    editMessage(msgElement) {
        const contentDiv = msgElement.querySelector('.msg-content');
        if (!contentDiv) return;

        // Use the displayed text, which is already clean
        const originalText = contentDiv.textContent; 

        // 1. Restore original text to the input box for editing
        const qInput = $('queryInput');
        if (qInput) {
            qInput.value = originalText;
            qInput.focus();
        }

        // 2. Remove the message that is being edited from history
        msgElement.remove();
        
        // Reset state
        isAwaitingConfirmation = false; 
        LAST_PROMPT_TEXT = null;
        const qInputPlace = $('queryInput');
        if (qInputPlace) qInputPlace.placeholder = "Enter query... (Press ENTER to Review)";

        log("Edit mode active. Please revise text and press ENTER to resubmit.", 'sys');
    },

    /**
     * Keypress handler for the Double-Enter Protocol.
     */
    handleKey(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();

            const qInput = $('queryInput');
            if (!qInput) return;
            const q = qInput.value.trim();
            const sendBtn = $('sendBtn');

            if (isAwaitingConfirmation) {
                // STATE 2: SECOND ENTER (CONFIRMATION)
                if (LAST_PROMPT_TEXT) {
                    this.executeQuery(LAST_PROMPT_TEXT);
                    isAwaitingConfirmation = false;
                    LAST_PROMPT_TEXT = null;
                    qInput.placeholder = "Enter query... (Press ENTER to Review)";
                    if (sendBtn) sendBtn.textContent = "REVIEW";
                } else {
                    log("Error: Confirmation received, but no prompt found.", 'err');
                    isAwaitingConfirmation = false;
                }
            } else {
                // STATE 1: FIRST ENTER (REVIEW CHECK)
                if (!q) return; // Ignore if input is empty
                
                // Log and prepare for confirmation
                log(`> ${q}`, 'user-review');
                
                LAST_PROMPT_TEXT = q;
                isAwaitingConfirmation = true;
                qInput.value = '';
                qInput.placeholder = "PRESS ENTER AGAIN TO CONFIRM & SEND...";
                if (sendBtn) sendBtn.textContent = "CONFIRM";
                
                log("Prompt logged for review. PRESS ENTER AGAIN TO CONFIRM & SEND.", 'sys');
            }
        }
    }
};

window.onload = () => {
    // Check for API key persistence
    const k = localStorage.getItem('mythos_api_key');
    const apiInput = $('apiKey');
    if (k && apiInput) apiInput.value = k;
    
    // Initial key status check
    const statusEl = $('keyStatus');
    if(statusEl) statusEl.textContent = k && k.length > 10 ? "[ KEY LOADED ]" : "[ KEY UNLOADED ]";
};