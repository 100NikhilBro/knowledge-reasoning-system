import type { ParsedDocument } from "../models/parsed-document.js";
import type { Section } from "../models/parsed-document.js";

export class PEPParser {

  parse(markdown: string): ParsedDocument {

    const metadata: Record<string, string> = {};
    

const sections: Section[] = [];

    const lines = markdown.split(/\r?\n/);

    // -------------------------
    // Metadata
    // -------------------------

    let index = 0;

    while (index < lines.length) {

      const line = lines[index].trim();

      if (line === "") {
        index++;
        continue;
      }

      if (!line.includes(":")) {
        break;
      }

      const [key, ...value] = line.split(":");

const normalizedKey = key
  .trim()
  .toLowerCase()
  .replace(/\s+/g, "_");

metadata[normalizedKey] = value.join(":").trim();

      index++;
    }

    // -------------------------
    // Sections
    // -------------------------

    let currentSection: Section | null = null;

    while (index < lines.length) {

      const line = lines[index].trim();

      // Heading detected
      if (
        index + 1 < lines.length &&
        /^[=]+$/.test(lines[index + 1].trim())
      ) {

        currentSection = {
  title: line,
  level: 1,
  content: ""
};

sections.push(currentSection);

        index += 2;

        continue;
      }

      if (currentSection && line !== "") {

        if (currentSection.content.length > 0) {
  currentSection.content += " ";
}

currentSection.content += line;
      }

      index++;
    }

   return {
  success: true,
  document: {
    metadata,
    sections,
    raw: markdown,
    warnings: []
  }
};

  }

}