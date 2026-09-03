// server.js - MYTHOS VAULT SERVER v1.1 (Consolidated API + Static File Server)

const express = require('express');
const path = require('path');
const app = express();
const PORT = 4000;

// 1. IMPORT AND MOUNT THE ORCHESTRATOR API (CRITICAL FIX)
// The orchestrator.js file exports the configured Express app (app)
const orchestratorApp = require('./orchestrator'); 

// Mount all routes from orchestratorApp (including /api/query/single, etc.)
// directly to the main app.
app.use(orchestratorApp); 

// 2. SERVE STATIC FILES (AFTER API ROUTES)
// This ensures that API requests are handled by the orchestrator *before* // the server attempts to find a matching file on the disk.
app.use(express.static(path.join(__dirname)));

// --- SERVER START ---
app.listen(PORT, () => {
    console.log('\n--------------------------------------------');
    console.log('MYTHOS VAULT SERVER ACTIVE');
    console.log(`Local Server Port: http://localhost:${PORT}`);
    console.log('--------------------------------------------');
    console.log('\nAccess Points:');
    console.log(`- Agent Setup:   http://localhost:${PORT}/agent_setup.html`);
    console.log(`- LorePack Tool: http://localhost:${PORT}/lorepack.html`);
    console.log(`- ChatPack Test: http://localhost:${PORT}/chatpack.html`);
    console.log('--------------------------------------------');
    console.log('API Status: Orchestrator routes are now integrated.');
});