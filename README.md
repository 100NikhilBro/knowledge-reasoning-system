# Knowledge Reasoning System

> A grounded reasoning system that converts documents into structured knowledge, retrieves relevant evidence through graph and semantic search, and generates answers that can be traced back to that knowledge.

**In simple terms:** KRS takes a knowledge document, turns it into a searchable knowledge graph and semantic index, and uses both to answer reasoning questions with evidence.

**Focus:** Evidence-grounded reasoning  
**Current Knowledge Format:** PEP-style Markdown documents

---

## Working Demonstration

https://github.com/user-attachments/assets/74608ecb-67fb-4100-ac56-2bfbd6d84f3e




The demonstration shows the deployed system processing knowledge, retrieving evidence, reasoning over it, verifying the result, and returning a grounded answer with citations and trace information.

---

## Why This Exists

A language model can generate a convincing answer even when the underlying evidence is weak, missing, or difficult to trace.

KRS focuses on a specific problem:

**Can a reasoning system answer from retrievable knowledge while making the supporting evidence visible?**

Instead of:

```text
Question → LLM → Answer
```

KRS uses:

```text
Question
   ↓
Retrieve Evidence
   ↓
Reason Over Evidence
   ↓
Ground the Answer
   ↓
Verify the Answer
   ↓
Answer + Evidence
```

---

## What KRS Does

KRS transforms supported knowledge documents into two complementary representations.

| Representation | Purpose |
|---|---|
| **Knowledge Graph** | Captures entities and explicit relationships |
| **Semantic Index** | Captures semantic meaning for similarity-based retrieval |

These representations are combined during reasoning.

---

## How It Works

| Stage | What Happens |
|---|---|
| **1. Ingest** | Reads a supported knowledge document |
| **2. Parse** | Converts the document into structured content |
| **3. Extract** | Identifies entities and relationships |
| **4. Index** | Stores graph knowledge in Neo4j and semantic vectors in Qdrant |
| **5. Retrieve** | Finds relevant graph and vector evidence |
| **6. Reason** | Selects and connects useful evidence |
| **7. Ground** | Restricts the answer context to retrieved evidence |
| **8. Verify** | Checks the generated answer against grounded evidence |
| **9. Answer** | Returns the answer with citations, confidence, and trace information |

---

## Why KRS?

The system is designed around three properties:

| Property | Goal |
|---|---|
| **Grounded** | Answers are based on retrieved knowledge |
| **Traceable** | Evidence and reasoning remain visible |
| **Fail-closed** | Unsupported claims are not silently invented |

For example, a compound query can connect:

| Evidence | Grounded Fact |
|---|---|
| Author | Guido van Rossum |
| Proposal | PEP-484 / Type Hints |
| Feature | Typing |
| Concern | Readability |
| Decision | Accepted |

---

## Bring Your Own Knowledge

KRS is not limited to one predefined question set.

A new supported knowledge document can pass through the same pipeline:

```text
New Knowledge Document
          ↓
        Parse
          ↓
Extract Entities + Relationships
          ↓
   Neo4j + Qdrant
          ↓
       Retrieval
          ↓
       Reasoning
          ↓
       Grounding
          ↓
      Verification
          ↓
        Answer
```

The current ingestion pipeline is built around **PEP-style Markdown knowledge documents**.

The initial PEP-484 document is therefore an example corpus rather than the conceptual limit of the reasoning pipeline.

---

## What You Can Ask

You can ask different types of questions against the indexed knowledge.

### Direct

```text
What is PEP-484?
```

### Relationship

```text
Who proposed PEP-484?
```

### Feature

```text
What feature does PEP-484 introduce?
```

### Decision

```text
What decision resulted from PEP-484?
```

### Compound

```text
Who proposed PEP-484, what did it introduce,
what concern did it address, and what decision resulted from it?
```

You can also create your own reasoning queries based on the available knowledge.

---

## Grounding & Fail-Closed Behavior

KRS does not treat the LLM as the source of truth.

The model receives evidence selected by the reasoning pipeline, and generated claims are checked against that evidence.

When the available knowledge does not support a requested claim, the system can fail closed instead of fabricating an answer.

Example:

```text
What relationship does PEP-484 have with quantum computing,
and what Python version implemented that relationship?
```

The system can return:

```text
Evidence used: 0
Confidence: 0
No answer was produced for this query.
```

This is intentional.

**KRS prefers an unanswered question over an unsupported answer.**

---

## Example Grounded Output

For a compound question:

```text
Who proposed PEP-484, what did it introduce,
what concern did it address, and what decision resulted from it?
```

the system can ground the response across multiple entities:

| Evidence | Result |
|---|---|
| Author | Guido van Rossum |
| Proposal | PEP-484 / Type Hints |
| Feature | Typing |
| Concern | Readability |
| Decision | Accepted |

The response can also expose:

- source document
- citations
- confidence
- reasoning trace
- retrieved evidence

---

## Key Capabilities

| Capability | Description |
|---|---|
| **Knowledge Graph Reasoning** | Reasons over explicit entity relationships |
| **Semantic Retrieval** | Finds semantically relevant knowledge |
| **Hybrid Retrieval** | Combines graph and vector evidence |
| **Relationship Reasoning** | Handles focused relationship questions |
| **Multi-hop Reasoning** | Supports multi-step evidence traversal |
| **Grounded Generation** | Generates from retrieved evidence |
| **Verification** | Checks generated claims against evidence |
| **Fail-Closed Behavior** | Avoids unsupported claims |
| **Citations** | Links answers to source evidence |
| **Reasoning Trace** | Shows selected reasoning evidence |
| **Confidence** | Surfaces result confidence |

---

## High Level Architecture

<!-- Add the final architecture diagram here -->

<p align="center">
 <img width="5045" height="2932" alt="image" src="https://github.com/user-attachments/assets/fa9c4d29-d043-49a9-8f35-b63fa0e93eb9" />
</p>

---

## Production Retrieval

### Structured Retrieval

```text
Neo4j
   ↓
Entities + Relationships
```

### Semantic Retrieval

```text
Jina Embeddings
      ↓
1024-dimensional vectors
      ↓
Qdrant
```

### Combined Retrieval

```text
Graph Evidence
      +
Vector Evidence
      ↓
Hybrid Evidence
      ↓
Reasoning
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Web | React · TypeScript · Vite |
| API | Node.js · Express · TypeScript |
| Ingestion | BullMQ |
| Parser | TypeScript |
| Extraction | Rule-based TypeScript |
| Knowledge Graph | Neo4j |
| Embeddings | Jina |
| Vector Store | Qdrant |
| Reasoning | TypeScript |
| Working Memory | Redis |
| LLM | Groq |
| Infrastructure | Docker |
| Deployment | Render |

---

## Live Demo

**Frontend:**  
https://knowledge-reasoning-system-web.onrender.com

**Backend Health:**  
https://knowledge-reasoning-system-api.onrender.com/health




---

## Testing

The system is validated across the main reasoning pipeline.

| Area | Coverage |
|---|---|
| **Retrieval** | Graph, vector, and hybrid retrieval |
| **Reasoning** | Planning and evidence selection |
| **Grounding** | Evidence-constrained answer generation |
| **Verification** | Unsupported-claim detection |
| **API** | Validation, authentication, and error handling |
| **Web** | Query, result, citation, and error flows |
| **End-to-End** | Full reasoning pipeline |

Run the complete verification pipeline:

```bash
pnpm verify
```

---

## Current Scope

KRS currently focuses on **indexed document knowledge**.

### Supported

- Knowledge graph reasoning
- Semantic retrieval
- Hybrid retrieval
- Relationship-focused reasoning
- Multi-hop reasoning
- Grounded LLM answers
- Evidence verification
- Citations
- Reasoning traces
- Confidence reporting

### Not Currently Supported

- Unrestricted web search
- Open-domain answers from model memory
- Autonomous agents
- Multi-agent systems
- Advanced reranking
- Large-scale external knowledge ingestion
- Production-grade multi-tenant identity and access control

The system is intentionally corpus-bound.

---

## Local Development

### Prerequisites

- Node.js `>= 22`
- pnpm `10.33.2`
- Docker

### Setup

```bash
git clone https://github.com/100NikhilBro/knowledge-reasoning-system.git
cd knowledge-reasoning-system

pnpm install

docker compose -f docker/docker-compose.yml up -d

cp .env.example .env
```

### Verify

```bash
pnpm verify
```

### Run

```bash
pnpm dev:api
```

```bash
pnpm dev:worker
```

```bash
pnpm dev:web
```

Web:

```text
http://localhost:5173
```

API:

```text
http://localhost:3000
```

---

## Future Scope

Future work focuses on strengthening reasoning quality before expanding into broader autonomous or open-domain workflows.

| Direction | Goal |
|---|---|
| **Retrieval Improvements** | Better ranking and evidence selection |
| **Typed Multi-hop Reasoning** | More precise relationship chains |
| **Query Decomposition** | Better handling of complex questions |
| **Larger Knowledge Corpora** | Expand indexed knowledge coverage |
| **Evaluation** | Systematically measure grounding and reasoning quality |
| **Observability** | Improve production visibility and diagnostics |
| **Broader Ingestion** | Support additional structured knowledge formats |
| **Agentic Workflows** | Extend reasoning toward controlled autonomous workflows |

---

## Build & Maintained By

**Nikhil Gupta**

Built and maintained with a focus on grounded reasoning, evidence traceability, and incremental system design.
