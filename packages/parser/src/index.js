// import fs from "node:fs";
// import path from "node:path";
// import { fileURLToPath } from "node:url";
// import { PEPParser } from "./parsers/pep.parser.js";
// const __filename = fileURLToPath(import.meta.url);
// const __dirname = path.dirname(__filename);
// const parser = new PEPParser();
// const filePath = path.resolve(
//   __dirname,
//   "../../../knowledge_state/raw/python-peps/pep-484.md"
// );
// const markdown = fs.readFileSync(filePath, "utf-8");
// const result = parser.parse(markdown);
// console.log(result.document);
export * from "./parsers/pep.parser.js";
export * from "./models/parsed-document.js";
