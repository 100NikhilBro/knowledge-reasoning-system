# Knowledge Reasoning System

Building a domain-specific reasoning system over Python PEP documents — combining a Neo4j knowledge graph, Qdrant vector index, hybrid NLU, multi-hop reasoning, and conservative soft implication to produce evidence-backed, traceable answers with claim-level verification and fail-closed behavior.

---

<img width="2612" height="845" alt="image" src="https://github.com/user-attachments/assets/1ffb3408-c652-4adb-a7b8-82b0c8217fd2" />

---

**Quick Start:**
```bash
git clone https://github.com/100NikhilBro/knowledge-reasoning-system.git
cd knowledge-reasoning-system
pnpm install
docker compose -f docker/docker-compose.yml up -d
cp .env.example .env
# Configure .env (Neo4j, Qdrant, Groq, Jina keys)
pnpm dev:api
pnpm dev:worker
pnpm dev:web
```

---

Resources that informed the design and direction of this project:

- [The GraphRAG Manifesto](https://neo4j.com/blog/genai/graphrag-manifesto/) — Why knowledge graphs matter for grounded RAG
- [Implementing 'From Local to Global' GraphRAG with Neo4j and LangChain](https://neo4j.com/blog/developer/global-graphrag-neo4j-langchain/) — Patterns for combining local and global retrieval
- [How to improve multi-hop reasoning with knowledge graphs and LLMs](https://neo4j.com/blog/genai/knowledge-graph-llm-multi-hop-reasoning/) — Multi-hop reasoning over graph structures
- [Using a knowledge graph to implement a RAG application](https://neo4j.com/blog/developer/rag-tutorial/) — Practical GraphRAG implementation
- [Hybrid Search in Neo4j](https://neo4j.com/blog/developer/hybrid-search-in-neo4j-full-text-vectors-and-graph-topology-with-cypher/) — Full-text, vectors, and graph topology with Cypher
- [Building Knowledge Graphs with LLM Graph Transformer](https://medium.com/data-science/building-knowledge-graphs-with-llm-graph-transformer-a91045c49b59) — Extracting structured knowledge from unstructured text


---


Still learning, improving, and refining this project whenever I get time.
If you want to improve, you are welcome.
