# MYTHOS ENTROPICA 2.0

## The MythOS Vault / LorePack Experimental Platform

**ENTROPICA 2.0 is an experimental checkpoint in the development of the MythOS cognitive architecture.**

This repository is not presented as the final MythOS system. It is a working Vault Server and browser-based experimental platform containing several important pieces developed along the way: agent identity and manifests, LorePack ingestion and curation, IndexedDB memory, gated retrieval, multi-agent dialogue, and the Hypervisor/API layer.

The purpose of this version is simple:

> **Preserve it. Run it. Examine it. Learn from it. Then build ENTROPICA 3.0.**

---

## What ENTROPICA 2.0 Is

ENTROPICA 2.0 brings together experiments around persistent AI identity, local semantic memory, retrieval-augmented generation, and multi-agent orchestration.

At its center is the **MythOS Vault**: a local/browser-oriented environment for maintaining agent identity, ingesting Lore, storing vectorized memory, retrieving relevant context, and passing that context into generation.

The repository also contains the beginning of a server-side Hypervisor architecture intended to coordinate static assets, agent endpoints, LorePack ingestion, context retrieval, and Gemini-backed generation.

This is therefore best understood as an **architectural snapshot**, rather than a finished product.

---

## Core Components

### Agent Manifest

`agents/agent_manifest.json` defines the system's agent identities, handles, ports, roles, behavioral metadata, system instructions, and Lore policies.

The manifest provides a canonical identity layer from which the browser and server components can establish agent context.

### LorePack

`lorepack.html` and `js/lorepack.js` form the browser-based LorePack tool.

LorePack currently supports:

* Selecting an agent identity
* Ingesting multiple `.txt` files
* Chunking source material
* Generating embeddings
* Storing vector records in IndexedDB
* Tracking source files and node counts
* Pausing and resuming ingestion
* Cancelling ingestion
* Editing individual stored nodes
* Deleting a source from an agent's memory
* Purging an agent's vectors
* Exporting a LorePack as JSON
* Importing a LorePack back into the local store

The current format separates the LorePack header/identity information from its `sacred_archive` vector records.

LorePack is therefore more than a file format: it is an **ingestion, curation, persistence, and portability workflow**.

### IndexedDB Memory

The browser-side database layer provides local persistence for agent records, vector memory, and conversation history.

This allows the experimental Vault architecture to operate around a local-first memory model rather than requiring every interaction to depend on a remote database.

### Retrieval Gate

`js/retrieval-gate.js` implements the **MAGRAG Retrieval Gate**, also described in the source as the **Sacred Contraction**.

Rather than blindly retrieving context for every query, the gate evaluates the query and active agent and determines whether retrieval should occur.

Current gate conditions include:

* Quarantine/Null-agent suppression
* Short conversational/phatic queries
* Explicit recall and lore triggers
* Historian/Archivist role mandates
* A query-complexity heuristic
* A closed-gate fallback

The result is a deliberate separation between **generation** and **context retrieval**.

### ChatPack Multi-Agent Dialogue

`js/chatpack-multi.js` provides the multi-agent dialogue layer.

It manages:

* Active agent selection
* Agent discovery
* Conversation history
* History caching
* Per-agent persistence
* Retrieval-gated context construction
* Multi-agent querying
* Generation through the API layer
* Chat history export

The important architectural idea is that ChatPack does not simply dump the entire memory store into every prompt. It asks the Retrieval Gate whether context is warranted and then requests a bounded set of relevant fragments.

### Hypervisor / Server Layer

`orchestrator.js` is the current server-side Hypervisor implementation.

It provides the foundation for:

* Express-based HTTP serving
* Static Vault assets
* Agent identity access
* Context/retrieval proxying
* LorePack ingestion
* Embedding requests
* Gemini generation requests
* Server-side vector persistence

The architecture is deliberately transitional. Some functionality remains browser/local-first while other pieces have begun moving toward a centralized Hypervisor model.

---

## Retrieval Architecture

The current retrieval flow can be viewed conceptually as:

```text
USER QUERY
    │
    ▼
AGENT IDENTITY
    │
    ▼
RETRIEVAL GATE
    │
    ├── CLOSED ───────────────► GENERATION
    │
    └── OPEN
          │
          ▼
       CONTEXT RETRIEVAL
          │
          ▼
       CONTEXT BLOCK
          │
          ▼
       GENERATION
```

This is an important experiment in **retrieval discipline**:

> **Memory is available, but retrieval is conditional.**

---

## Repository Map

```text
MYTHOS-ENTROPICA-2.0/
│
├── agents/
│   └── agent_manifest.json       Agent identities and system roles
│
├── css/
│   └── style.css                 Vault interface styling
│
├── js/
│   ├── core.js                   Shared browser/API infrastructure
│   ├── db.js                     Browser database layer
│   ├── mythos-db.js              IndexedDB implementation
│   ├── lorepack.js               LorePack ingestion/curation engine
│   ├── ingestion.worker.js       Ingestion worker
│   ├── retrieval-gate.js         MAGRAG retrieval gating
│   ├── chatpack-multi.js         Multi-agent dialogue engine
│   ├── chatpack-ui.js            Chat interface
│   ├── chatpack-v4.9-ARCHIVE.js  Archived ChatPack implementation
│   └── audit_lexicon.js          Lexicon auditing
│
├── lorepack.html                 LorePack management interface
├── chatpack.html                 ChatPack interface
├── agent_console.html            Agent console
├── agent_setup.html              Agent setup interface
├── agent_setup_2.html            Alternate setup interface
├── console.html                  Vault console
├── codeshop.html                 Experimental code/lexicon interface
│
├── orchestrator.js               MythOS Hypervisor / server
├── server.js                     Server entry/support component
├── package.json                  Node/Express configuration
├── package-lock.json             Dependency lockfile
│
└── reference / lexicon assets     Supporting language and curation material
```

---

## Design Principles

Several principles are visible throughout the current implementation.

### Local First

Memory is designed to live locally in the browser through IndexedDB, with export/import providing portability.

### Agent-Centric Memory

Vectors are associated with an `agentId`, allowing Lore to remain associated with the identity for which it was ingested.

### Source Awareness

Vector records retain their originating source filename, allowing Lore to be curated and removed at the source level rather than treating the vector store as an undifferentiated mass.

### Retrieval Discipline

The Retrieval Gate attempts to determine **when memory should be consulted**, rather than assuming every query requires RAG.

### Separation of Concerns

The project is developing toward distinct layers for:

* Identity
* Memory
* Retrieval
* Dialogue
* Generation
* Orchestration
* Interface

### Portability

LorePack export/import provides a portable representation of an agent's accumulated vector memory.

---

## What This Version Is Not

ENTROPICA 2.0 should **not** be mistaken for the final architecture.

It does not represent every experiment, optimization, data structure, compression technique, graph mechanism, retrieval innovation, or later memory-store work developed during the broader MythOS/Entropica project.

The broader development lineage includes additional experiments involving vector representations, graph structures, coordinate systems, serialization and compression strategies, and larger-scale memory stores. Those should not automatically be assumed to be implemented in this repository.

That distinction matters.

**This repository is a baseline.**

---

## Why Keep It?

Because prototypes contain evidence.

ENTROPICA 2.0 contains working experiments that should be examined before the next architectural generation is designed.

Some components may be retained.

Some may be discarded.

Some may reveal ideas that deserve to be rebuilt properly in ENTROPICA 3.0.

The objective is therefore not to declare every component here production-ready.

The objective is to understand **what was learned**.

---

## Experimental Status

**Status:** Experimental / Development Archive

**Primary environment:** Browser + IndexedDB + Node.js/Express

**Generation/embedding backend:** Gemini API integration

**Primary concepts:**

* MythOS
* LorePack
* MAGRAG
* Retrieval Gate
* Multi-agent dialogue
* Persistent agent identity
* Local semantic memory
* Hypervisor orchestration

This repository should be treated as a **research and engineering checkpoint**.

---

## ENTROPICA 3.0

ENTROPICA 3.0 should begin from examination rather than assumption.

Before rewriting anything, the 2.0 implementation should be evaluated for:

1. What actually works.
2. What merely works accidentally.
3. What architectural ideas are sound.
4. What should be consolidated.
5. What should be removed.
6. What should move server-side.
7. What should remain local-first.
8. What should become a formal protocol or data structure.
9. What performance characteristics were actually achieved.
10. Which experiments from the broader Entropica work need to be reincorporated.

> **ENTROPICA 2.0 is the specimen. ENTROPICA 3.0 is the next synthesis.**

---

## License

See `LICENSE` for the repository's licensing terms.

---

*MYTHOS ENTROPICA — Experimental Cognitive Architecture*
