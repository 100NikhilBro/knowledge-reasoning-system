import { describe, expect, it } from "vitest";

import type { SessionState } from "../src/types/session-state.js";

describe("SessionState", () => {

  it("represents an active reasoning session", () => {

    const session: SessionState = {

      sessionId: "session-123",

      memory: {

        query: "What is RAG?",

        rewrittenQuery: "retrieval augmented generation",

        status: "active"

      }

    };

    expect(session.sessionId)
      .toBe("session-123");

    expect(session.memory.query)
      .toBe("What is RAG?");

    expect(session.memory.status)
      .toBe("active");

  });

});