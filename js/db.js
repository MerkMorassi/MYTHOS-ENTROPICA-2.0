// z:/MYTHOS-VAULT-SERVER/js/core/db.js
// A robust, agent-aware IndexedDB persistence layer.

export class ChatDB {
    constructor(dbName = 'MythOS_ChatPack_DB') {
        this.dbName = dbName;
        this.db = null;
    }

    async open() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, 1);

            request.onupgradeneeded = (e) => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains('agents')) {
                    db.createObjectStore('agents', { keyPath: 'id' });
                }
                if (!db.objectStoreNames.contains('history')) {
                    // Use agentId as an index for efficient lookups
                    const historyStore = db.createObjectStore('history', { keyPath: 'id', autoIncrement: true });
                    historyStore.createIndex('agentId_idx', 'agentId', { unique: false });
                }
            };

            request.onsuccess = (e) => {
                this.db = e.target.result;
                console.log('✅ Database connection established.');
                resolve(this.db);
            };

            request.onerror = (e) => {
                console.error('❌ Database connection failed:', e.target.error);
                reject(e.target.error);
            };
        });
    }

    // --- Agent Management ---
    async saveAgent(agentData) {
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction('agents', 'readwrite');
            tx.objectStore('agents').put(agentData);
            tx.oncomplete = () => resolve();
            tx.onerror = (e) => reject(e.target.error);
        });
    }

    async getAgent(agentId) {
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction('agents', 'readonly');
            const request = tx.objectStore('agents').get(agentId);
            request.onsuccess = () => resolve(request.result);
            request.onerror = (e) => reject(e.target.error);
        });
    }

    async listAgents() {
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction('agents', 'readonly');
            const request = tx.objectStore('agents').getAll();
            request.onsuccess = () => resolve(request.result);
            request.onerror = (e) => reject(e.target.error);
        });
    }

    async clearAllAgents() {
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(['agents', 'history'], 'readwrite');
            tx.objectStore('agents').clear();
            tx.objectStore('history').clear();
            tx.oncomplete = () => resolve();
            tx.onerror = (e) => reject(e.target.error);
        });
    }

    // --- History Management ---
    async saveHistory(agentId, messages) {
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction('history', 'readwrite');
            const store = tx.objectStore('history');
            // Clear old history for the agent first
            const index = store.index('agentId_idx');
            const cursorReq = index.openCursor(IDBKeyRange.only(agentId));
            cursorReq.onsuccess = (e) => {
                const cursor = e.target.result;
                if (cursor) {
                    cursor.delete();
                    cursor.continue();
                }
            };
            // Add new history
            messages.forEach(msg => store.add({ ...msg, agentId }));
            tx.oncomplete = () => resolve();
            tx.onerror = (e) => reject(e.target.error);
        });
    }

    async loadHistory(agentId) {
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction('history', 'readonly');
            const store = tx.objectStore('history');
            const index = store.index('agentId_idx');
            const request = index.getAll(agentId);
            request.onsuccess = () => resolve(request.result);
            request.onerror = (e) => reject(e.target.error);
        });
    }
}