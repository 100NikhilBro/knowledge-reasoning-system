import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { PEPParser } from "@knowledge/parser";
import { EntityExtractor } from "./extractors/entity.extractor.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const markdown = fs.readFileSync(
  path.resolve(
    __dirname,
    "../../../knowledge_state/raw/python-peps/pep-484.md"
  ),
  "utf8"
);

const parser = new PEPParser();

const result = parser.parse(markdown);

const extractor = new EntityExtractor();

const entities = extractor.extract(result.document);

console.dir(entities, { depth: null });