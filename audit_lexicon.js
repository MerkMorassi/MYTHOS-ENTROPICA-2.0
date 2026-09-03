// audit_lexicon.js - LEXICON AUDITOR v1.3 (ALPHABETICAL & CONSOLIDATED)
// Final version before LLM CLEANER deployment.

const fs = require('fs');
const path = require('path');

// --- CONFIGURATION ---
const RAW_LORE_DIRECTORY = path.join(__dirname, 'lore_raw');
const WHITELIST_FILE = path.join(__dirname, 'White-List-Urania.txt');
const GLOSSARY_OUTPUT_FILE = path.join(__dirname, 'Glossary_Allegorical_Terms.txt');
const MIN_FREQUENCY = 5; 
const MIN_WORD_LENGTH = 4; 
const STOP_WORDS = new Set(['the', 'and', 'to', 'a', 'of', 'in', 'is', 'it', 'that', 'with', 'be', 'i', 'we', 'are', 'for', 'at', 'on', 'my', 'your', 'his', 'her', 'its', 'from', 'as', 'by', 'do', 'he', 'she', 'they', 'you', 'or', 'was', 'were', 'had', 'have', 'has', 'said', 'will', 'must', 'only']); 

// --- UTILITIES ---

function loadKnownLexicon() {
    try {
        const content = fs.readFileSync(WHITELIST_FILE, 'utf8');
        const words = content.split(/[\n,;]/)
                             .map(w => w.trim().toLowerCase())
                             .filter(w => w.length > 0);
        return new Set(words);
    } catch (e) {
        return new Set();
    }
}

function runAudit() {
    console.log(`\n🌀 LEXICON AUDITOR PROTOCOL V1.3 INITIATED (ALPHABETICAL SORT) 🌀`);
    
    if (!fs.existsSync(RAW_LORE_DIRECTORY)) {
        console.error(`[AUDITOR] ERROR: Input directory not found: ${RAW_LORE_DIRECTORY}`);
        return;
    }
    
    const files = fs.readdirSync(RAW_LORE_DIRECTORY)
                    .filter(file => file.endsWith('.txt'))
                    .map(file => path.join(RAW_LORE_DIRECTORY, file));

    if (files.length === 0) {
        console.log(`[AUDITOR] STATUS: No .txt files found. Audit aborted.`);
        return;
    }

    const knownLexicon = loadKnownLexicon();
    const candidateTally = new Map();
    const slashCommands = new Set();
    let totalTokens = 0;
    
    // Pattern 1: Multi-word phrases
    const properNounPhraseRegex = /([A-Z][a-z0-9]+(?:\s[A-Z][a-z0-9]+)+)/g;
    // Pattern 2: Single capitalized words (Neologisms/Names)
    const singleWordRegex = /\b[A-Z][a-z0-9]{3,}\b/g;
    const commandRegex = /(\/[\w\-]+)/g;

    // --- STEP 1: Discovery & Frequency Tally (Identical to V1.2) ---
    for (const filePath of files) {
        const content = fs.readFileSync(filePath, 'utf8');
        
        let match;
        
        // Find Proper Noun Phrases (Pattern 1)
        properNounPhraseRegex.lastIndex = 0; 
        while ((match = properNounPhraseRegex.exec(content)) !== null) {
            const phrase = match[0].trim();
            if (phrase.split(/\s+/).length >= 2 && !knownLexicon.has(phrase.toLowerCase())) {
                candidateTally.set(phrase, (candidateTally.get(phrase) || 0) + 1);
            }
        }
        
        // Find Single Neologisms (Pattern 2)
        singleWordRegex.lastIndex = 0;
        while ((match = singleWordRegex.exec(content)) !== null) {
            const word = match[0];
            const lowerWord = word.toLowerCase();
            
            if (word.length >= MIN_WORD_LENGTH && !STOP_WORDS.has(lowerWord) && !knownLexicon.has(lowerWord)) {
                 candidateTally.set(word, (candidateTally.get(word) || 0) + 1);
            }
        }

        // Find Slash Commands
        commandRegex.lastIndex = 0;
        while ((match = commandRegex.exec(content)) !== null) {
            slashCommands.add(match[0].trim());
        }
        
        totalTokens += (content.match(/\b\w+\b/g) || []).length;
    }

    // --- STEP 2: Consolidation and Alphabetical Sorting ---
    const allTerms = [];
    
    // Consolidate filtered terms
    Array.from(candidateTally.entries())
         .filter(([, count]) => count >= MIN_FREQUENCY) // Apply frequency filter
         .forEach(([phrase, count]) => {
             allTerms.push({ term: phrase, type: phrase.includes(' ') ? 'PHRASE' : 'WORD', count: count });
         });
    
    // Add Commands
    slashCommands.forEach(command => {
        allTerms.push({ term: command, type: 'COMMAND', count: 0 });
    });
    
    // CRITICAL FIX: Sort terms alphabetically (A-Z)
    allTerms.sort((a, b) => a.term.localeCompare(b.term));

    const glossaryTerms = allTerms.map(item => {
        const typeLabel = item.type === 'COMMAND' ? '[SYSTEM COMMAND]' : '';
        const paddedTerm = item.term.padEnd(30);
        return `${paddedTerm}: ${typeLabel} [DEFINITION PENDING]`;
    });
    
    const finalCandidateList = allTerms.map(item => `[${item.type}] ${item.term} (Freq: ${item.count})`);

    // --- STEP 3: Output Generation ---
    
    // 3A: Generate the Glossary File
    const glossaryContent = `
# MYTHOS ALLEORICAL GLOSSARY - ${new Date().toISOString()}
# TARGET: Canonical Terms (Alphabetical Index)
# ACTION: Provide the canonical definition for each term below.
# ------------------------------------------------------------------

${glossaryTerms.join('\n')}
    `;
    fs.writeFileSync(GLOSSARY_OUTPUT_FILE, glossaryContent.trim(), 'utf8');
    
    // 3B: Generate the Candidate Review File (Alphabetical Index)
    const candidatesContent = `
# MYTHOS LEXICON AUDIT REPORT - ${new Date().toISOString()}
# Total Lore Tokens Scanned: ${totalTokens}
# Filter: Freq >= ${MIN_FREQUENCY}, Word Len >= ${MIN_WORD_LENGTH}
# New Candidates Discovered: ${finalCandidateList.length}

# ------------------------------------------------------------------
# NEW CANDIDATES FOR REVIEW (ALPHABETICAL INDEX)
# ACTION: Use this list to update 'White-List-Urania.txt'.
# ------------------------------------------------------------------

${finalCandidateList.join('\n')}
    `;
    fs.writeFileSync(WHITELIST_FILE, candidatesContent.trim(), 'utf8'); // NOTE: Overwriting the old White-List placeholder for review
    
    console.log(`\n✅ AUDIT COMPLETE. Consolidated and Alphabetized ${finalCandidateList.length} terms.`);
    console.log(`-> Glossary Terms (Canonical Review): ${path.basename(GLOSSARY_OUTPUT_FILE)}`);
    console.log(`\n➡️ NEXT STEP: Manually review and finalize the glossary definitions.`);
}

runAudit();