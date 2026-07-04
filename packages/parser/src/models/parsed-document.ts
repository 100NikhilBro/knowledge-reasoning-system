export interface Section {
  title: string;
  level: number;
  content: string;
}

export interface ParseWarning {
  code: string;
  message: string;
}

export interface ParsedDocument {
  metadata: Record<string, string>;
  sections: Section[];
  raw: string;
  warnings: ParseWarning[];
}

export interface ParseResult {
  document: ParsedDocument;
  errors: string[];
}