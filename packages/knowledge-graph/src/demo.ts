import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { PEPParser } from "@knowledge/parser";
import {
  EntityExtractor,
  RelationshipExtractor
} from "@knowledge/extractor";

// import { GraphTraversalService } from "./traversal/graph-traversal.service.js";

import { GraphService } from "./services/graph.service.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function bootstrap() {

  const markdown = fs.readFileSync(
    path.resolve(
      __dirname,
      "../../../knowledge_state/raw/python-peps/pep-484.md"
    ),
    "utf8"
  );

  const parser = new PEPParser();

  const parsed = parser.parse(markdown);

  const entityExtractor = new EntityExtractor();

  const entities = entityExtractor.extract(parsed.document);

  const relationshipExtractor = new RelationshipExtractor();

  const relationships = relationshipExtractor.extract(entities);

  const graph = new GraphService();

  console.log("Connecting...\n");

  console.log(await graph.healthCheck());

  await graph.initialize();

  await graph.ingest(
    entities,
    relationships
  );


// const traversal = new GraphTraversalService();

// const proposal = await traversal.findNodeById(
//   "Proposal",
//   "PEP-484"
// );

// console.log("\n========== RETRIEVAL ==========\n");


// console.log("\n========== NEIGHBORS ==========\n");

// console.dir(
//   await traversal.findNeighbors(
//     "Proposal",
//     "PEP-484"
//   ),
//   { depth: null }
// );

// console.log("\n========== RELATIONSHIPS ==========\n");

// console.dir(
//   await traversal.findRelationships(
//     "Proposal",
//     "PEP-484"
//   ),
//   { depth: null }
// );

// console.log("\n========== ALL PROPOSALS ==========\n");

// console.dir(
//   await traversal.findNodesByLabel(
//     "Proposal"
//   ),
//   { depth: null }
// );

// console.dir(proposal, {
//   depth: null
// });


// console.log("\n========== SUBGRAPH ==========\n");

// console.dir(

//   await traversal.findSubgraph(
//     "Proposal",
//     "PEP-484"
//   ),

//   {
//     depth: null
//   }

// );


// console.log("\n========== SHORTEST PATH ==========\n");

// console.dir(

//   await traversal.findShortestPath(
//     "Proposal",
//     "PEP-484",
//     "Author",
//     "guido-van-rossum"
//   ),

//   { depth: null }

// );

  await graph.disconnect();

  console.log("\nKnowledge graph updated successfully.");

}


bootstrap().catch(console.error);