export interface MemoryState {

  query: string;

  rewrittenQuery?: string;

  status: "active" | "completed" | "failed";

}