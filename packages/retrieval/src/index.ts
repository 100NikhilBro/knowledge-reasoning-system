export {};import { Neo4jGraphRetriever }
from "./graph/graph.retriever.js";

const retriever =
  new Neo4jGraphRetriever();

console.dir(

  await retriever.findNode(
    "proposal:PEP-484"
  ),

  {
    depth: null
  }

);