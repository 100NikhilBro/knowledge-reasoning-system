import type { ParseResult } from "../models/parsed-document.js";
export declare class PEPParser {
    private validator;
    parse(markdown: string): ParseResult;
    private normalize;
    private parseMetadata;
    private parseSections;
    private buildDocument;
}
