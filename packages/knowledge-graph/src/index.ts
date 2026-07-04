import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { PEPParser } from "@knowledge/parser";
import {
  EntityExtractor,
  RelationshipExtractor
} from "@knowledge/extractor";

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

  await graph.disconnect();

  console.log("\nKnowledge graph updated successfully.");

}

bootstrap().catch(console.error);