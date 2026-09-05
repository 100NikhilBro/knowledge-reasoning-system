# Knowledge Reasoning System

> A general-purpose knowledge reasoning architecture that combines structured knowledge graphs and semantic retrieval to produce evidence-backed, verifiable answers.

KRS converts supported knowledge documents into structured and semantic representations, retrieves relevant evidence, reasons over relationships, grounds generation in that evidence, and verifies the resulting answer.

**Current ingestion:** PEP-style Markdown documents
**Architecture:** Knowledge Graph + Semantic Retrieval + Evidence-Grounded Reasoning

---

## Working Demonstration

https://github.com/user-attachments/assets/d7f39b94-9e38-4494-a99c-cd6369d562fc



The demonstration shows document ingestion, retrieval, relationship reasoning, verification, and grounded answer generation.

---

## Why KRS

A simple LLM pipeline looks like:

```text
Question → LLM → Answer
```

The problem is that the answer can be difficult to ground, verify, or trace back to its source.

KRS instead follows:

```text
Knowledge
   ↓
Parse + Extract
   ↓
Graph + Semantic Index
   ↓
Query Understanding
   ↓
Hybrid Retrieval
   ↓
Evidence Filtering
   ↓
Reasoning
   ↓
Grounding
   ↓
Generation
   ↓
Verification
   ↓
Answer + Evidence + Citations + Trace
```

The LLM is therefore used as part of the reasoning pipeline rather than being treated as the source of truth.

---

## How It Works

Knowledge documents are transformed into two complementary representations:

| Representation            | Purpose                                        |
| ------------------------- | ---------------------------------------------- |
| **Neo4j Knowledge Graph** | Entities, relationships, and graph traversal   |
| **Qdrant Semantic Index** | Semantic similarity retrieval using embeddings |

The retrieval layer combines both channels:

```text
Graph Evidence ─────┐
                    ├─→ Score Normalization
Vector Evidence ────┘
                           ↓
                     Weighted Fusion
                           ↓
                  Evidence Filtering
                           ↓
                       Reasoning
                           ↓
                    Grounded Context
                           ↓
                     LLM Generation
                           ↓
                      Verification
```

Knowledge ingestion runs asynchronously through a BullMQ worker, while the API handles interactive reasoning requests.

---

## What Makes It Different

### Relationship-aware reasoning

KRS reasons over explicit graph relationships rather than treating semantic similarity as a relationship.

```text
Direct:
A ──→ B

Connected:
A ──→ X ──→ B
```

An indirect path is not presented as a direct relationship.

The system supports bounded multi-hop traversal while preserving the actual entities, relationship types, and direction used in the graph.

### Evidence before generation

Retrieved evidence is filtered for compatibility before being used to construct the grounded context.

### Verification

Generated answers are checked against the evidence used to produce them.

### Fail-closed behavior

When the indexed knowledge does not support a claim, KRS can refuse to produce an unsupported answer instead of falling back to unrestricted model knowledge.

For example, if the graph contains:

```text
PEP-484 ──INTRODUCES──→ Typing
PEP-484 ──ADDRESSES───→ Readability
```

KRS does not infer:

```text
Typing ──→ Readability
```

A direct relationship query can instead return that the relationship was not established.

---

## Example

A compound query such as:

```text
Who proposed PEP-484, what did it introduce,
and what concern did it address?
```

can be grounded through relationships such as:

```text
PEP-484
   ├── PROPOSED_BY ──→ Guido van Rossum
   ├── INTRODUCES ──→ Typing
   └── ADDRESSES ──→ Readability
```

The result can expose supporting evidence, citations, provenance, confidence, and reasoning trace.

---

## Architecture

<p align="center">
  <img width="5045" height="2932" alt="Knowledge Reasoning System Architecture" src="https://github.com/user-attachments/assets/fa9c4d29-d043-49a9-8f35-b63fa0e93eb9" />
</p>




---

## Key Capabilities

* Hybrid graph + vector retrieval
* Knowledge graph reasoning
* Relationship-aware reasoning
* Bounded multi-hop traversal
* Direct relationship checks
* Evidence compatibility filtering
* Grounded generation
* Answer verification
* Fail-closed behavior
* Evidence provenance and citations
* Reasoning traces
* Confidence reporting

---

## Tech Stack

| Layer           | Technology                     |
| --------------- | ------------------------------ |
| Web             | React · TypeScript · Vite      |
| API             | Node.js · Express · TypeScript |
| Worker          | Node.js · TypeScript · BullMQ  |
| Extraction      | Rule-based TypeScript          |
| Knowledge Graph | Neo4j                          |
| Embeddings      | Jina                           |
| Vector Store    | Qdrant                         |
| Working Memory  | Redis                          |
| LLM             | Groq                           |
| Infrastructure  | Docker                         |
| Deployment      | Render                         |

---

## Current Scope

KRS is intentionally **corpus-bound**.

### Implemented

* Knowledge document ingestion
* PEP-style Markdown processing
* Entity and relationship extraction
* Knowledge graph persistence
* Graph retrieval
* Semantic retrieval
* Hybrid retrieval
* Query understanding and planning
* Single-hop and multi-hop reasoning
* Evidence synthesis and filtering
* Grounded generation
* Verification
* Citations and provenance
* Reasoning traces
* Confidence reporting
* API and web applications

### Current Ingestion Boundary

The current ingestion implementation is demonstrated with **PEP-style Markdown documents**.

The reasoning architecture operates on entities, relationships, and evidence and is not conceptually limited to PEP-484.

### Not Currently Supported

* Unrestricted web search
* Open-domain reasoning from model memory
* Autonomous or multi-agent systems
* Advanced learned reranking
* Arbitrary document ingestion
* Production-grade multi-tenancy

---

## Quick Start

### Requirements

* Node.js `>= 22`
* pnpm `10.33.2`
* Docker

### Setup

```bash
git clone https://github.com/100NikhilBro/knowledge-reasoning-system.git
cd knowledge-reasoning-system

pnpm install

docker compose -f docker/docker-compose.yml up -d

cp .env.example .env
```

Configure the required environment variables in `.env`.

### Verify

```bash
pnpm verify
```

### Run

```bash
pnpm dev:api
pnpm dev:worker
pnpm dev:web
```

Local services:

```text
Web  → http://localhost:5173
API  → http://localhost:3000
```

---

## Testing

The repository includes validation across:

* retrieval
* reasoning
* grounding
* verification
* API behavior
* web flows
* end-to-end reasoning

Run the complete verification pipeline with:

```bash
pnpm verify
```

---

## Future Scope

* Stronger retrieval and evidence ranking
* Broader knowledge ingestion
* More precise multi-hop reasoning
* Systematic grounding evaluation
* Controlled agentic workflows

---

## Build & Maintained By

**Nikhil Gupta**

Built with a focus on grounded reasoning, explicit knowledge relationships, evidence traceability, and incremental system design.
