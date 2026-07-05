export interface KnowledgeEntity {
    id: string;
    type: string;
    label: string;
    source: string;
    confidence: number;
    properties: Record<string, unknown>;
}
