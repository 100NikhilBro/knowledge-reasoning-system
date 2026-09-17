# Knowledge Reasoning System

A domain-specific reasoning system over Python PEP documents. Combines a Neo4j knowledge graph and Qdrant vector index with hybrid NLU, multi-hop reasoning, conservative soft implication, and claim-level verification to produce evidence-backed, traceable answers with fail-closed behavior.


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

Still learning, improving, and refining this project whenever I get time.
If you want to improve, you are welcome.

