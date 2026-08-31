export interface Citation {
  source: string;
  entityId: string;
}

export interface KnowledgeEntity {
  id: string;
  type: string;
  label: string;
  source: string;
  confidence: number;
  properties: Record<string, unknown>;
}

export interface KnowledgeRelationship {
  from: string;
  to: string;
  type: string;
  confidence: number;
  properties?: Record<string, unknown>;
}

export interface Evidence {
  entity: KnowledgeEntity;
  score: number;
  source: string;
  relationship?: KnowledgeRelationship;
}

export interface ReasoningStep {
  description: string;
  evidence: Evidence[];
}

export interface ReasoningTrace {
  steps: ReasoningStep[];
}

export interface AnswerExplanation {
  answer: string;
  reasoning: string[];
}

export interface ReasoningResult {
  answer: string;
  confidence: number;
  citations: Citation[];
  trace: ReasoningTrace;
  comparison?: string;
  explanation?: AnswerExplanation;
}

export interface ReasoningRequest {
  query: string;
  topK?: number;
  sessionId?: string;
}

export type ApiErrorCode =
  | "INVALID_REQUEST"
  | "UNAUTHORIZED"
  | "RATE_LIMITED"
  | "REASONING_FAILED"
  | "NETWORK_ERROR"
  | "UNKNOWN";

export interface PublicApiError {
  error: string;
  code: ApiErrorCode | string;
}

export type HealthStatus = "ok" | "down" | "unknown";
