export interface ReasoningTrace {

  query: string;

  traversal: string[];

  evidenceCount: number;

  conflicts: number;

  confidence: number;

}