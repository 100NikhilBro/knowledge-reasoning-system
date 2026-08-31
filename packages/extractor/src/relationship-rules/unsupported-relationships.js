/**
 * Declared RelationshipType values that remain unsupported by extraction
 * until the parser/source provides structured related-PEP evidence
 * (e.g. Replaces / Superseded-By / Requires headers with resolvable targets).
 *
 * RELATED_TO  — no generic evidence rule without fabricating links
 * SUPERSEDES  — needs structured replacement metadata + target Proposal
 */
export const UNSUPPORTED_RELATIONSHIP_TYPES = [
    "RELATED_TO",
    "SUPERSEDES"
];
