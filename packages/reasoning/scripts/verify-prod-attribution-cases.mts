import {
  understandQuery
} from "../src/utils/query-understanding.js";

import {
  buildStructuredAnswerContext,
  selectAnswerEvidence
} from "../src/utils/select-answer-evidence.js";

import {
  relationshipAttributionIsGrounded
} from "../src/utils/relationship-attribution.js";

import {
  DefaultAnswerVerifier
} from "../src/services/answer-verifier.service.js";

const pep = {
  id: "proposal:PEP-484",
  type: "Proposal",
  label: "Type Hints",
  source: "pep.md",
  confidence: 1,
  properties: { pep: "484", title: "Type Hints" }
};
const typing = {
  id: "feature:typing",
  type: "Feature",
  label: "Typing",
  source: "pep.md",
  confidence: 1,
  properties: {}
};
const guido = {
  id: "author:guido",
  type: "Author",
  label: "Guido van Rossum",
  source: "pep.md",
  confidence: 1,
  properties: {}
};
const readability = {
  id: "concern:readability",
  type: "Concern",
  label: "Readability",
  source: "pep.md",
  confidence: 1,
  properties: {}
};
const pep526 = {
  id: "proposal:PEP-526",
  type: "Proposal",
  label: "Variable Annotations",
  source: "x",
  confidence: 1,
  properties: { pep: "526", title: "Variable Annotations" }
};
const pep604 = {
  id: "proposal:PEP-604",
  type: "Proposal",
  label: "Union Syntax",
  source: "x",
  confidence: 1,
  properties: { pep: "604", title: "Union Syntax" }
};

function ev(
  entity: typeof pep,
  relationship?: {
    from: string;
    to: string;
    type: string;
    confidence: number;
    properties: Record<string, unknown>;
  },
  score = 0.95
) {
  return {
    entity,
    score,
    source: "graph",
    ...(relationship ? { relationship } : {})
  };
}

function rel(
  from: string,
  to: string,
  type: string
) {
  return {
    from,
    to,
    type,
    confidence: 1,
    properties: {}
  };
}

const bag = [
  ev(pep, rel(pep.id, typing.id, "INTRODUCES")),
  ev(pep, rel(pep.id, guido.id, "PROPOSED_BY")),
  ev(pep, rel(pep.id, readability.id, "ADDRESSES")),
  ev(pep526, rel(pep526.id, typing.id, "INTRODUCES")),
  ev(pep604, rel(pep604.id, typing.id, "INTRODUCES")),
  ev(pep),
  ev(typing),
  ev(guido),
  ev(readability),
  ev(pep526),
  ev(pep604),
  ev(typing, rel(pep.id, typing.id, "INTRODUCES"), 0.5)
];

function run(
  query: string,
  answer: string
) {
  const understanding =
    understandQuery(query);

  const selected =
    selectAnswerEvidence(understanding, bag);

  const context = {
    query,
    understanding,
    answerContext:
      buildStructuredAnswerContext(understanding, selected),
    evidence: selected,
    items: selected.map(item => ({
      entityId: item.entity.id,
      entityType: item.entity.type,
      label: item.entity.label,
      source: item.entity.source,
      confidence: 1,
      score: item.score,
      evidenceSource: "graph",
      properties: item.entity.properties ?? {},
      ...(item.relationship
        ? { relationship: item.relationship }
        : {})
    })),
    budget: {
      maxEvidence: 50,
      inputCount: bag.length,
      retainedCount: selected.length,
      truncated: false
    },
    config: { maxEvidence: 50 }
  };

  const attr =
    relationshipAttributionIsGrounded(answer, context);

  const outcome =
    new DefaultAnswerVerifier().verify({
      result: {
        answer,
        confidence: 0.9,
        citations: [],
        trace: { steps: [] }
      },
      context
    });

  console.log(
    JSON.stringify(
      {
        query,
        answer,
        intent: understanding.intent,
        attr,
        status: outcome.result.trace.meta?.verificationStatus,
        conf: outcome.result.confidence,
        selectedRels: selected
          .filter(item => item.relationship)
          .map(item =>
            `${item.relationship!.from}|${item.relationship!.type}|${item.relationship!.to}`
          ),
        claims: context.answerContext?.claimEvidence?.map(claim => ({
          s: claim.subject,
          p: claim.predicate,
          o: claim.object,
          n: claim.evidence.filter(item => item.relationship).length
        })),
        steps: outcome.result.trace.steps
          .map(step => step.description)
          .filter(line => /Verification:|attribution/i.test(line))
      },
      null,
      2
    )
  );
}

const cases: Array<[string, string]> = [
  ["What did PEP-484 introduce?", "Type Hints introduced Typing."],
  ["What did PEP-484 introduce?", "PEP-484 introduced the Typing feature."],
  ["What did PEP-484 introduce?", "Typing"],
  ["Who proposed PEP-484?", "Type Hints was proposed by Guido van Rossum."],
  [
    "How are PEP-526 and PEP-604 connected through Typing?",
    "Variable Annotations introduced Typing. Union Syntax introduced Typing."
  ],
  [
    "Who proposed PEP-484, what did it introduce, and what concern did it address?",
    "Type Hints was proposed by Guido van Rossum. Type Hints introduced Typing. Type Hints addressed Readability."
  ],
  ["How is PEP-484 connected to Typing?", "Type Hints introduced Typing."]
];

for (const [query, answer] of cases) {
  run(query, answer);
}
