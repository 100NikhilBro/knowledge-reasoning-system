# Knowledge Reasoning System

Evidence-grounded Q&A over Python PEP documents. Combines Neo4j knowledge graph and Qdrant vector index, with claim-level verification and reasoning traces.


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

Still learning, improving, and refining this project whenever I get time.
If you want to improve, you are welcome.
