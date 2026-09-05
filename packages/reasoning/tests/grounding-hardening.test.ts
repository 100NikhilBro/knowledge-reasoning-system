import {
  describe,
  expect,
  it
} from "vitest";

import { DefaultContextBuilder }
from "../src/services/context-builder.service.js";

import { DefaultAnswerVerifier }
from "../src/services/answer-verifier.service.js";

import {
  isGeneratedAnswerGrounded,
  extractConcreteClaims
} from "../src/utils/is-generated-answer-grounded.js";

import {
  buildPartialGroundedAnswer
} from "../src/utils/build-partial-grounded-answer.js";

import type { ReasoningContext }
from "../src/types/reasoning-context.js";

import type { Evidence } from "@knowledge/shared";

function buildContext(
  evidence: Evidence[],
  query?: string
): ReasoningContext {

  const context =
    new DefaultContextBuilder({
      maxEvidence: 20
    }).build({
      evidence
    });

  if (query) {
    context.query = query;
  }

  return context;

}

function pep484Context(): ReasoningContext {

  return buildContext(
    [
      {
        entity: {
          id: "proposal:PEP-484",
          type: "Proposal",
          label: "Type Hints",
          source: "pep-484.md",
          confidence: 1,
          properties: {
            pep: "484",
            title: "Type Hints"
          }
        },
        score: 1,
        source: "graph",
        relationship: {
          id: "rel:proposed-by",
          type: "PROPOSED_BY",
          from: "proposal:PEP-484",
          to: "author:guido-van-rossum",
          confidence: 1
        }
      },
      {
        entity: {
          id: "author:guido-van-rossum",
          type: "Author",
          label: "Guido van Rossum",
          source: "pep-484.md",
          confidence: 1,
          properties: {}
        },
        score: 0.95,
        source: "graph"
      },
      {
        entity: {
          id: "feature:typing",
          type: "Feature",
          label: "Typing",
          source: "pep-484.md",
          confidence: 1,
          properties: {}
        },
        score: 0.9,
        source: "graph",
        relationship: {
          id: "rel:introduces",
          type: "INTRODUCES",
          from: "proposal:PEP-484",
          to: "feature:typing",
          confidence: 1
        }
      },
      {
        entity: {
          id: "concern:readability",
          type: "Concern",
          label: "Readability",
          source: "pep-484.md",
          confidence: 1,
          properties: {}
        },
        score: 0.85,
        source: "graph"
      },
      {
        entity: {
          id: "decision:accepted",
          type: "Decision",
          label: "Accepted",
          source: "pep-484.md",
          confidence: 1,
          properties: {
            status: "Accepted"
          }
        },
        score: 0.8,
        source: "graph"
      }
    ],
    "How can Python code express expected types?"
  );

}

describe("LLM grounding hardening", () => {

  const verifier =
    new DefaultAnswerVerifier();

  it("accepts a valid grounded paraphrase", () => {

    const context =
      pep484Context();

    const answer =
      "PEP-484 introduces Type Hints so code can express expected types and improve Readability.";

    expect(
      isGeneratedAnswerGrounded(answer, context)
    ).toBe(true);

    const outcome =
      verifier.verify({
        result: {
          answer,
          confidence: 4,
          citations: [
            {
              entityId: "proposal:PEP-484",
              source: "pep-484.md"
            }
          ],
          trace: { steps: [] }
        },
        context
      });

    expect(outcome.report.accepted).toBe(true);
    expect(outcome.result.answer).toBe(answer);

  });

  it("accepts partial-evidence answers that state unsupported portions explicitly", () => {

    const context =
      pep484Context();

    const answer =
      buildPartialGroundedAnswer(context);

    expect(
      isGeneratedAnswerGrounded(answer, context)
    ).toBe(true);

    const outcome =
      verifier.verify({
        result: {
          answer,
          confidence: 3,
          citations: [
            {
              entityId: "proposal:PEP-484",
              source: "pep-484.md"
            }
          ],
          trace: { steps: [] }
        },
        context
      });

    expect(outcome.report.accepted).toBe(true);
    expect(outcome.result.answer).toMatch(
      /Type Hints introduced Typing|Type Hints was proposed by/i
    );
    expect(outcome.result.answer).not.toMatch(
      /available evidence does not support additional claims/i
    );

  });

  it("rejects unknown entity ids", () => {

    const context =
      pep484Context();

    expect(
      isGeneratedAnswerGrounded(
        "Type Hints were created by concept:quantum-lab.",
        context
      )
    ).toBe(false);

  });

  it("rejects unsupported relationship tokens absent from context", () => {

    const context =
      pep484Context();

    expect(
      isGeneratedAnswerGrounded(
        "Type Hints TELEPORTS_TO feature:typing via QUANTUM_LINK.",
        context
      )
    ).toBe(false);

  });

  it("rejects unsupported factual attributes absent from context", () => {

    const context =
      pep484Context();

    expect(
      isGeneratedAnswerGrounded(
        "Type Hints have status: Rejected according to the record.",
        context
      )
    ).toBe(false);

  });

  it("rejects unsupported specific details and examples absent from context", () => {

    const context =
      pep484Context();

    expect(
      isGeneratedAnswerGrounded(
        "Type Hints allow annotations such as `Vector3f` and \"hyperbolic-monad\".",
        context
      )
    ).toBe(false);

    expect(
      isGeneratedAnswerGrounded(
        "Type Hints let developers annotate function signatures for static type checkers.",
        context
      )
    ).toBe(false);

  });

  it("rejects parameterized type examples absent from grounded context", () => {

    const context =
      pep484Context();

    const answer =
      "Python code can express expected types using List[int], Dict[str, float], and Callable[..., str].";

    expect(
      extractConcreteClaims(answer)
    ).toEqual(
      expect.arrayContaining([
        "List[int]",
        "Dict[str, float]",
        "Callable[..., str]"
      ])
    );

    expect(
      isGeneratedAnswerGrounded(answer, context)
    ).toBe(false);

    const outcome =
      verifier.verify({
        result: {
          answer,
          confidence: 9,
          citations: [
            {
              entityId: "feature:typing",
              source: "pep-484.md"
            }
          ],
          trace: { steps: [] }
        },
        context
      });

    expect(outcome.report.accepted).toBe(true);
    expect(outcome.result.answer).toMatch(
      /Type Hints introduced Typing|Feature: Typing/i
    );
    expect(outcome.result.answer).not.toMatch(
      /available evidence does not support additional claims/i
    );
    expect(outcome.result.answer).not.toMatch(/List\[int\]|Dict\[str/);

  });

  it("accepts a valid PEP-484 grounded natural-language answer", () => {

    const context =
      pep484Context();

    const answer =
      "PEP-484 is the proposal titled Type Hints; it INTRODUCES Typing.";

    expect(
      isGeneratedAnswerGrounded(answer, context)
    ).toBe(true);

  });

  it("accepts who-proposed style answers grounded on the author", () => {

    const context =
      pep484Context();

    const answer =
      "Guido van Rossum proposed PEP-484 (Type Hints).";

    expect(
      isGeneratedAnswerGrounded(answer, context)
    ).toBe(true);

    const outcome =
      verifier.verify({
        result: {
          answer,
          confidence: 5,
          citations: [
            {
              entityId: "author:guido-van-rossum",
              source: "pep-484.md"
            }
          ],
          trace: { steps: [] }
        },
        context
      });

    expect(outcome.report.accepted).toBe(true);

  });

  it("accepts concern/readability grounded answers", () => {

    const context =
      pep484Context();

    const answer =
      "Type Hints address the Readability concern.";

    expect(
      isGeneratedAnswerGrounded(answer, context)
    ).toBe(true);

  });

  it("allows grounded attributes that appear in context properties", () => {

    const context =
      pep484Context();

    expect(
      isGeneratedAnswerGrounded(
        "The decision for Type Hints has status: Accepted.",
        context
      )
    ).toBe(true);

  });

  it("rejects invented hyphenated details absent from context", () => {

    const context =
      pep484Context();

    expect(
      isGeneratedAnswerGrounded(
        "Type Hints is an accepted standards-track proposal for Readability.",
        context
      )
    ).toBe(false);

  });

  it("allows grounded relationship tokens that appear in context", () => {

    const context =
      pep484Context();

    expect(
      isGeneratedAnswerGrounded(
        "PEP-484 PROPOSED_BY Guido van Rossum and INTRODUCES Typing.",
        context
      )
    ).toBe(true);

  });

});
