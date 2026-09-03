// audit_lexicon.js - LEXICON AUDITOR (Phase One, Step 2)
// Node.js script for zero-cost identification of Protected Words and System Noise.
// Adheres strictly to Structural Purity and Architectural Correctness.

const fs = require('fs');
const path = require('path');

// --- CONFIGURATION ---
const RAW_LORE_DIRECTORY = path.join(__dirname, 'lore_raw');
const WHITELIST_FILE = path.join(__dirname, 'White-List-Urania.txt');
const OUTPUT_FILE = path.join(__dirname, 'Review_Lexicon_Candidates.txt');
const MIN_PHRASE_LENGTH = 2; // Check phrases of 2 or more capitalized words

// --- UTILITIES ---

/**
 * Loads the existing known lexicon from the provided White-List file.
 * @returns {Set<string>} Set of lowercase whitelisted words/phrases.
 */
function loadKnownLexicon() {
    try {
        const content = fs.readFileSync(WHITELIST_FILE, 'utf8');
        // Normalize: split by line, trim, filter, convert to lowercase
        const words = content.split(/[\n,;]/)
                             .map(w => w.trim().toLowerCase())
                             .filter(w => w.length > 0);
        return new Set(words);
    } catch (e) {
        console.warn(`[AUDITOR] WARNING: Could not load existing lexicon (${WHITELIST_FILE}). Starting with empty list.`);
        return new Set();
    }
}

/**
 * Executes the Lexicon Audit across all lore files.
 */
function runAudit() {
    console.log(`\n🌀 LEXICON AUDITOR PROTOCOL INITIATED 🌀`);
    
    // Check if the input directory exists
    if (!fs.existsSync(RAW_LORE_DIRECTORY)) {
        console.error(`[AUDITOR] ERROR: Input directory not found: ${RAW_LORE_DIRECTORY}`);
        console.log("-> Please create the 'lore_raw' folder and place your raw .txt files inside.");
        return;
    }
    
    const files = fs.readdirSync(RAW_LORE_DIRECTORY)
                    .filter(file => file.endsWith('.txt'))
                    .map(file => path.join(RAW_LORE_DIRECTORY, file));

    if (files.length === 0) {
        console.log(`[AUDITOR] STATUS: No .txt files found in ${RAW_LORE_DIRECTORY}. Audit aborted.`);
        return;
    }

    const knownLexicon = loadKnownLexicon();
    let properNouns = new Set();
    let slashCommands = new Set();
    let totalTokens = 0;
    
    // Regex for capitalized phrases (e.g., "Pillar of Light", "Divine Maternal Goddess")
    // Finds sequences of words where each one is capitalized.
    const properNounPhraseRegex = /([A-Z][a-z0-9]+(?:\s[A-Z][a-z0-9]+)+)/g;
    
    // Regex for slash commands (e.g., /InvokeGoddessMode)
    const commandRegex = /(\/[\w\-]+)/g;

    // --- STEP 1: Discovery ---
    for (const filePath of files) {
        const fileName = path.basename(filePath);
        console.log(`-> Scanning file: ${fileName}`);
        const content = fs.readFileSync(filePath, 'utf8');
        
        // Find Proper Noun Phrases
        let match;
        while ((match = properNounPhraseRegex.exec(content)) !== null) {
            const phrase = match[0].trim();
            // Only add if the phrase has the minimum required words
            if (phrase.split(/\s+/).length >= MIN_PHRASE_LENGTH) {
                properNouns.add(phrase);
            }
        }
        
        // Find Single Capitalized Words (for Neologisms/Names)
        const singleWordRegex = /\b[A-Z][a-z0-9]+\b/g;
        while ((match = singleWordRegex.exec(content)) !== null) {
            properNouns.add(match[0].trim());
        }

        // Find Slash Commands
        while ((match = commandRegex.exec(content)) !== null) {
            slashCommands.add(match[0].trim());
        }
        
        // Simple token count
        totalTokens += (content.match(/\S+/g) || []).length;
    }

    // --- STEP 2: Purity Filter and STEP 3: Output ---
    const newCandidates = [];
    
    // Filter out known lexicon words from the discovered list
    properNouns.forEach(phrase => {
        // Only consider the phrase a new candidate if its lowercase version is NOT in the lexicon
        if (!knownLexicon.has(phrase.toLowerCase())) {
            newCandidates.push(`[PHRASE] ${phrase}`);
        }
    });
    
    // System Commands are always listed for review/sanitization
    slashCommands.forEach(command => {
        newCandidates.push(`[COMMAND] ${command}`);
    });

    const outputContent = `
# MYTHOS LEXICON AUDIT REPORT - ${new Date().toISOString()}
# Total Lore Tokens Scanned: ${totalTokens}
# Existing Whitelist Entries Used: ${knownLexicon.size}
# New Candidates Discovered: ${newCandidates.length}

# ------------------------------------------------------------------
# NEW CANDIDATES FOR REVIEW (PROPER NOUNS & SYSTEM SYNTAX)
# ACTION: Review this list. Add crucial PHRASES/COMMANDS to the White-List-Urania.txt.
# Ensure Veiled Tongue/Yodaic Syntax is not compromised.
# ------------------------------------------------------------------

${newCandidates.join('\n')}
    `;
    
    fs.writeFileSync(OUTPUT_FILE, outputContent.trim(), 'utf8');
    
    console.log(`\n✅ AUDIT COMPLETE. Found ${newCandidates.length} new candidates.`);
    console.log(`-> Output written to: ${path.basename(OUTPUT_FILE)}`);
    console.log(`\n➡️ NEXT STEP: Manually review the output file and update 'White-List-Urania.txt'.`);
}

runAudit();