import type {
  ParsedDocument,
  ParseResult,
  Section
} from "../models/parsed-document.js";


import { ParserValidator } from "../validators/parser.validator.js";

import { ParserState } from "../enums/parser-state.js";

export class PEPParser {

  private validator = new ParserValidator();

  parse(markdown: string): ParseResult {

    const normalized = this.normalize(markdown);

    const lines = normalized.split("\n");

    const metadata = this.parseMetadata(lines);

    const sections = this.parseSections(lines);

    const document = this.buildDocument(
      normalized,
      metadata,
      sections
    );

    this.validator.validate(document);

    return {
      document,
      errors: []
    };

  }

  private normalize(markdown: string): string {

    return markdown
      .replace(/\r\n/g, "\n")
      .replace(/\t/g, " ")
      .trim();

  }

  private parseMetadata(lines: string[]): Record<string, string> {

  const metadata: Record<string, string> = {};

  let state = ParserState.READ_METADATA;

  for (const rawLine of lines) {

    const line = rawLine.trim();

    if (state === ParserState.READ_METADATA) {

      if (line === "") {
        continue;
      }

      if (!line.includes(":")) {
        state = ParserState.READ_SECTION;
        break;
      }

      const [key, ...value] = line.split(":");

      const normalizedKey = key
        .trim()
        .toLowerCase()
        .replace(/\s+/g, "_");

      metadata[normalizedKey] = value.join(":").trim();

    }

  }

  return metadata;

}

  private parseSections(lines: string[]): Section[] {

    const sections: Section[] = [];

    let currentSection: Section | null = null;

    let index = 0;

    while (index < lines.length) {

      const line = lines[index].trim();

      if (
        index + 1 < lines.length &&
        /^([=-]+)$/.test(lines[index + 1].trim())
      ) {

        const underline = lines[index + 1].trim();

        currentSection = {
          title: line,
          level: underline.startsWith("=") ? 1 : 2,
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

    return sections;

  }

  private buildDocument(
    raw: string,
    metadata: Record<string, string>,
    sections: Section[]
  ): ParsedDocument {

    return {
      metadata,
      sections,
      raw,
      warnings: []
    };

  }

}