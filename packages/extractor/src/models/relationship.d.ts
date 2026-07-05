export interface KnowledgeRelationship {
    from: string;
    to: string;
    type: string;
    confidence: number;
    properties?: Record<string, unknown>;
}
