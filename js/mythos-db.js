// js/mythos-db.js - MYTHOS VAULT // SimpleDB (Final Path Correction)
// IndexedDB wrapper supporting basic CRUD operations expected by client modules.

export class SimpleDB {
    constructor(dbName = 'mythos_vault') {
        this.dbName = dbName;
        this.db = null;
        this.ready = this.open();
    }
    
    async open() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, 5); 
            
            request.onupgradeneeded = (e) => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains('agents')) db.createObjectStore('agents', { keyPath: 'id' });
                
                if (!db.objectStoreNames.contains('vectors')) {
                    const vectorStore = db.createObjectStore('vectors', { keyPath: 'id' });
                    vectorStore.createIndex('agentId', 'agentId', { unique: false }); 
                }
                
                if (!db.objectStoreNames.contains('agent_settings')) {
                    db.createObjectStore('agent_settings', { keyPath: 'agentId' });
                }
                
                if (!db.objectStoreNames.contains('logs')) db.createObjectStore('logs', { keyPath: 'id', autoIncrement: true });
                if (!db.objectStoreNames.contains('settings')) db.createObjectStore('settings', { keyPath: 'key' });

                if (!db.objectStoreNames.contains('chat_history')) {
                    db.createObjectStore('chat_history', { keyPath: 'id' }); 
                }
            };
            
            request.onsuccess = (e) => { this.db = e.target.result; resolve(); };
            request.onerror = (e) => reject(e.target.error);
        });
    }
    
    // Core transaction wrapper (Robust and Promise-based)
    async tx(storeName, mode, callback) {
        await this.ready;
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(storeName, mode);
            const store = tx.objectStore(storeName);
            const result = callback(store);
            
            if (result instanceof IDBRequest) {
                result.onsuccess = () => resolve(result.result);
                result.onerror = () => reject(tx.error);
            } else {
                tx.oncomplete = () => resolve();
                tx.onerror = () => reject(tx.error);
            }
        });
    }
    
    // --- CONVENIENCE METHODS ---
    
    async getById(storeName, key) { 
        return this.tx(storeName, 'readonly', store => store.get(key)); 
    }
    
    async put(storeName, item) { 
        if (!item.id && storeName !== 'logs') {
            console.error(`Attempted put to ${storeName} without 'id' key path.`, item);
            return Promise.reject(new Error(`Data object requires an 'id' property. Cannot save.`));
        }
        return this.tx(storeName, 'readwrite', store => store.put(item)); 
    }
    
    async get(storeName, key) { return this.getById(storeName, key); } 
    async delete(storeName, key) { return this.tx(storeName, 'readwrite', store => store.delete(key)); }
    async getAll(storeName) { return this.tx(storeName, 'readonly', store => store.getAll()); }
    async getByIndex(storeName, indexName, query) { return this.tx(storeName, 'readonly', store => store.index(indexName).getAll(query)); }
    async clear(storeName) { return this.tx(storeName, 'readwrite', store => store.clear()); }
    async addBulk(storeName, items) { 
        return this.tx(storeName, 'readwrite', store => items.forEach(item => store.put(item))); 
    }

    // --- CRITICAL AGENT MANIFEST INJECTOR ---
    async ensureAgentsLoaded() {
        try {
            const agents = await this.getAll('agents');
            if (agents && agents.length > 0) {
                return false; 
            }

            console.log("DB: Agents store empty. Attempting static manifest injection...");

            // CRITICAL FIX: Explicit relative path
            const response = await fetch('./agents/agent_manifest.json');
            
            if (!response.ok) {
                console.warn(`DB: Static manifest fetch failed. Status: ${response.status} at path: ./agents/agent_manifest.json`);
                return false;
            }

            const manifest = await response.json();
            if (!Array.isArray(manifest)) {
                 console.error("DB: Manifest format error. Expected an array.");
                 return false;
            }
            
            await this.addBulk('agents', manifest);
            console.log(`DB: Successfully injected ${manifest.length} agents from manifest.`);
            return true;

        } catch (e) {
            console.error("DB: Agent manifest injection failed:", e);
            return false;
        }
    }
}