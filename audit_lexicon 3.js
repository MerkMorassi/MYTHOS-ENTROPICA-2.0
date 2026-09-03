// audit_lexicon.js - LEXICON AUDITOR v1.2 (GLOSSARY CREATION)
// Focuses on multi-word allegorical terms and high-frequency proper nouns.

const fs = require('fs');
const path = require('path');

// --- CONFIGURATION ---
const RAW_LORE_DIRECTORY = path.join(__dirname, 'lore_raw');
const WHITELIST_FILE = path.join(__dirname, 'White-List-Urania.txt');
const GLOSSARY_OUTPUT_FILE = path.join(__dirname, 'Glossary_Allegorical_Terms.txt');
const CANDIDATES_OUTPUT_FILE = path.join(__dirname, 'Review_Lexicon_Candidates.txt');

const MIN_FREQUENCY = 5; // Increased frequency for final selection
const MIN_WORD_LENGTH = 4;
const STOP_WORDS = new Set(['the', 'and', 'to', 'a', 'of', 'in', 'is', 'it', 'that', 'with', 'be', 'i', 'we', 'are', 'for', 'at', 'on', 'my', 'your', 'his', 'her', 'its', 'from', 'as', 'by', 'do', 'he', 'she', 'they', 'you', 'or', 'was', 'were', 'had', 'have', 'has', 'said', 'will', 'must', 'only']); // Added common noise

// --- UTILITIES ---

function loadKnownLexicon() {
    try {
        const content = fs.readFileSync(WHITELIST_FILE, 'utf8');
        const words = content.split(/[\n,;]/)
                             .map(w => w.trim().toLowerCase())
                             .filter(w => w.length > 0);
        return new Set(words);
    } catch (e) {
        // console.warn(`[AUDITOR] WARNING: Could not load existing lexicon. Creating new.`);
        return new Set();
    }
}

/**
 * Executes the Lexicon Audit and generates two output files.
 */
function runAudit() {
    console.log(`\n🌀 LEXICON AUDITOR PROTOCOL V1.2 INITIATED (GLOSSARY EXTRACTION) 🌀`);
    
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
    
    // Pattern 1: Multi-word phrases (High Allegorical Value)
    const properNounPhraseRegex = /([A-Z][a-z0-9]+(?:\s[A-Z][a-z0-9]+)+)/g;
    // Pattern 2: Single capitalized neologisms (High Unique Value)
    const singleWordRegex = /\b[A-Z][a-z0-9]{3,}\b/g;
    const commandRegex = /(\/[\w\-]+)/g;

    // --- STEP 1: Discovery & Frequency Tally ---
    for (const filePath of files) {
        const content = fs.readFileSync(filePath, 'utf8');
        
        let match;
        
        // Find Proper Noun Phrases (Pattern 1)
        properNounPhraseRegex.lastIndex = 0; 
        while ((match = properNounPhraseRegex.exec(content)) !== null) {
            const phrase = match[0].trim();
            // Only add if the phrase has the minimum required words
            if (phrase.split(/\s+/).length >= 2 && !knownLexicon.has(phrase.toLowerCase())) {
                candidateTally.set(phrase, (candidateTally.get(phrase) || 0) + 1);
            }
        }
        
        // Find Single Neologisms (Pattern 2)
        singleWordRegex.lastIndex = 0;
        while ((match = singleWordRegex.exec(content)) !== null) {
            const word = match[0];
            const lowerWord = word.toLowerCase();
            
            // Filter common English words
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

    // --- STEP 2: Purity Filter and Frequency Sorting ---
    const finalCandidates = [];
    const glossaryTerms = [];
    
    // Sort by frequency (Highest first)
    const sortedTerms = Array.from(candidateTally.entries())
                           .filter(([, count]) => count >= MIN_FREQUENCY)
                           .sort(([, countA], [, countB]) => countB - countA);
                           
    // Process Sorted Terms
    sortedTerms.forEach(([phrase, count]) => {
        const isMultiWord = phrase.includes(' ');
        
        // Add to general candidates list
        finalCandidates.push(`[PHRASE] ${phrase} (Freq: ${count})`);
        
        // Add to GLOSSARY if it's an allegorical phrase OR a highly unique single word
        if (isMultiWord || count >= 50) { // High frequency single words are likely important names/neologisms
             glossaryTerms.push(`${phrase.padEnd(30)}: [DEFINITION PENDING]`);
        }
    });
    
    // System Commands are always listed and added to the glossary section for review
    slashCommands.forEach(command => {
        finalCandidates.push(`[COMMAND] ${command} (Freq: N/A)`);
        glossaryTerms.push(`${command.padEnd(30)}: [SYSTEM COMMAND - DEFINITION PENDING]`);
    });

    // --- STEP 3: Output Generation ---
    
    // 3A: Generate the Glossary File
    const glossaryContent = `
# MYTHOS ALLEORICAL GLOSSARY - ${new Date().toISOString()}
# TARGET: Terms for the 'Veiled Tongue' and 'Yodaic Syntax'
# ACTION: Provide the canonical definition for each term below.
# ------------------------------------------------------------------

${glossaryTerms.join('\n')}
    `;
    fs.writeFileSync(GLOSSARY_OUTPUT_FILE, glossaryContent.trim(), 'utf8');
    
    // 3B: Generate the Candidate Review File (Reduced List)
    const candidatesContent = `
# MYTHOS LEXICON AUDIT REPORT - ${new Date().toISOString()}
# Total Lore Tokens Scanned: ${totalTokens}
# Filter: Freq >= ${MIN_FREQUENCY}, Word Len >= ${MIN_WORD_LENGTH}
# New Candidates Discovered: ${finalCandidates.length}

# ------------------------------------------------------------------
# NEW CANDIDATES FOR REVIEW (RANKED BY FREQUENCY - HIGHEST FIRST)
# ACTION: Use this list to update 'White-List-Urania.txt'.
# ------------------------------------------------------------------

${finalCandidates.join('\n')}
    `;
    fs.writeFileSync(CANDIDATES_OUTPUT_FILE, candidatesContent.trim(), 'utf8');
    
    console.log(`\n✅ AUDIT COMPLETE. Final candidates reduced to ${finalCandidates.length}.`);
    console.log(`-> Review List (Whitelist Update): ${path.basename(CANDIDATES_OUTPUT_FILE)}`);
    console.log(`-> Glossary Terms (Canonical Review): ${path.basename(GLOSSARY_OUTPUT_FILE)}`);
    console.log(`\n➡️ NEXT STEP: Manually review BOTH output files and update 'White-List-Urania.txt'.`);
}

runAudit();