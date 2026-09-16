import {
  describe,
  expect,
  it
} from "vitest";

import {
  DefaultReasoningPlanner
} from "../src/services/reasoning-planner.service.js";

import {
  classifyQueryIntent,
  normalizeQueryText,
  understandQuery
} from "../src/utils/query-understanding.js";

describe("query intent classification (P2)", () => {

  const planner =
    new DefaultReasoningPlanner();

  it("normalizes whitespace without destroying PEP identifiers", () => {

    expect(
      normalizeQueryText("  What is   PEP-484?  ")
    ).toBe("What is PEP-484?");

    const understanding =
      understandQuery("Was Typing introduced by PEP-484?");

    expect(understanding.entities).toEqual(
      expect.arrayContaining(["PEP-484", "Typing"])
    );

    expect(understanding.normalizedQuery).toContain("PEP-484");

  });

  it("FACT: What is PEP-484?", () => {

    expect(classifyQueryIntent("What is PEP-484?"))
      .toBe("FACT");

  });

  it("RELATIONSHIP: Who proposed PEP-484?", async () => {

    expect(classifyQueryIntent("Who proposed PEP-484?"))
      .toBe("RELATIONSHIP");

    const plan =
      await planner.plan({
        query: "Who proposed PEP-484?"
      });

    expect(plan.intent).toBe("RELATIONSHIP");
    expect(plan.strategy).toBe("single-hop");
    expect(plan.focusRelationships).toEqual(["PROPOSED_BY"]);

  });

  it("DIRECT_RELATIONSHIP: How is Typing directly related to Readability?", async () => {

    expect(
      classifyQueryIntent(
        "How is Typing directly related to Readability?"
      )
    ).toBe("DIRECT_RELATIONSHIP");

    const plan =
      await planner.plan({
        query: "How is Typing directly related to Readability?"
      });

    expect(plan.intent).toBe("DIRECT_RELATIONSHIP");
    expect(plan.strategy).toBe("single-hop");
    expect(plan.requireRelationshipBetween).toEqual({
      left: "Typing",
      right: "Readability"
    });

  });

  it("CONNECTED_RELATIONSHIP: How are Typing and Readability connected?", () => {

    expect(
      classifyQueryIntent(
        "How are Typing and Readability connected?"
      )
    ).toBe("CONNECTED_RELATIONSHIP");

  });

  it("BRIDGE: How are Typing and Readability connected through PEP-484?", async () => {

    const understanding =
      understandQuery(
        "How are Typing and Readability connected through PEP-484?"
      );

    expect(understanding.intent).toBe("BRIDGE_RELATIONSHIP");
    expect(understanding.bridgeEntity).toMatch(/PEP-484/i);
    expect(understanding.rewrittenRepresentation).toMatch(/mode=BRIDGE/);

    const plan =
      await planner.plan({
        query:
          "How are Typing and Readability connected through PEP-484?"
      });

    expect(plan.intent).toBe("BRIDGE_RELATIONSHIP");
    expect(plan.strategy).toBe("multi-hop");

  });

  it("COMPOUND: Who proposed, introduce, and concern", async () => {

    const query =
      "Who proposed PEP-484, what did it introduce, and what concern did it address?";

    expect(classifyQueryIntent(query)).toBe("COMPOUND");

    const plan =
      await planner.plan({ query });

    expect(plan.intent).toBe("COMPOUND");
    expect(plan.strategy).toBe("single-hop");
    expect(plan.focusRelationships).toEqual(
      expect.arrayContaining([
        "PROPOSED_BY",
        "INTRODUCES",
        "ADDRESSES"
      ])
    );
    expect(plan.rewrittenRepresentation).toMatch(
      /compound claims:|subrequests:/i
    );

  });

  it("IMPLICATION: Can we conclude that Typing improves runtime performance?", () => {

    const understanding =
      understandQuery(
        "Can we conclude that Typing improves runtime performance?"
      );

    expect(understanding.intent).toBe("IMPLICATION");
    expect(understanding.rewrittenRepresentation).toMatch(
      /Evaluate whether the available evidence supports/
    );
    expect(understanding.rewrittenRepresentation).toMatch(/IMPROVES/);
    expect(understanding.rewrittenRepresentation).not.toMatch(
      /What did PEP-484 introduce/i
    );

  });

  it("IMPLICATION: Why introduce … to improve runtime performance", async () => {

    const query =
      "Why did PEP-484 introduce Typing to improve runtime performance?";

    expect(classifyQueryIntent(query)).toBe("IMPLICATION");

    const plan =
      await planner.plan({ query });

    expect(plan.intent).toBe("IMPLICATION");
    expect(plan.strategy).toBe("explanation");

  });

  it("ANALYTICAL: How many PEPs introduce typing-related features?", () => {

    const understanding =
      understandQuery(
        "How many PEPs introduce typing-related features?"
      );

    expect(understanding.intent).toBe("ANALYTICAL");
    expect(understanding.analytical?.operation).toBe("COUNT");
    expect(understanding.rewrittenRepresentation).toMatch(/COUNT/);

  });

  it("SUMMARIZATION: How did Python typing evolve across indexed PEPs?", () => {

    expect(
      classifyQueryIntent(
        "How did Python typing evolve across the indexed PEPs?"
      )
    ).toBe("SUMMARIZATION");

    expect(
      classifyQueryIntent(
        "Summarize the evolution of Python typing across the indexed PEPs."
      )
    ).toBe("SUMMARIZATION");

  });

  it("OUT_OF_CORPUS: What is the capital of France?", () => {

    expect(
      classifyQueryIntent("What is the capital of France?")
    ).toBe("OUT_OF_CORPUS");

    expect(
      classifyQueryIntent("What is the capital of PEP-484?")
    ).not.toBe("OUT_OF_CORPUS");

  });

  it("mixed-intent: Who proposed PEP-484 and how does it relate to Typing?", async () => {

    const query =
      "Who proposed PEP-484 and how does it relate to Typing?";

    expect(classifyQueryIntent(query)).toBe("COMPOUND");

    const plan =
      await planner.plan({ query });

    expect(plan.intent).toBe("COMPOUND");
    expect(plan.strategy).toBe("single-hop");
    expect(plan.focusRelationships).toEqual(["PROPOSED_BY"]);

  });

  it("paraphrases keep stable intent classes", () => {

    expect(
      classifyQueryIntent("Was Typing introduced by PEP-484?")
    ).toBe("RELATIONSHIP");

    expect(
      classifyQueryIntent(
        "Is Typing connected to Readability through the proposal?"
      )
    ).toBe("BRIDGE_RELATIONSHIP");

    expect(
      classifyQueryIntent(
        "Does PEP-484 establish that Typing improves runtime performance?"
      )
    ).toBe("IMPLICATION");

    expect(
      classifyQueryIntent(
        "What evidence connects Typing and Readability?"
      )
    ).toBe("CONNECTED_RELATIONSHIP");

  });

  it("does not over-classify plain why as IMPLICATION", () => {

    expect(
      classifyQueryIntent("Why was PEP-484 proposed?")
    ).not.toBe("IMPLICATION");

  });

  it("rewrite never substitutes an easier question for implication", () => {

    const understanding =
      understandQuery(
        "Can we conclude that Typing improves runtime performance?"
      );

    expect(understanding.rewrittenRepresentation.toLowerCase())
      .not.toContain("who proposed");

    expect(understanding.claims.some(claim =>
      claim.predicate === "IMPROVES"
    )).toBe(true);

  });

});
