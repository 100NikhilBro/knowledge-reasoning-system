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

const pepId = "proposal:PEP-484";

const typing = {
  id: "feature:typing",
  type: "Feature",
  label: "Typing",
  source: "x",
  confidence: 1,
  properties: {}
};

const pep = {
  id: pepId,
  type: "Proposal",
  label: "Type Hints",
  source: "x",
  confidence: 1,
  properties: { pep: "484", title: "Type Hints" }
};

const introduces = {
  from: pepId,
  to: typing.id,
  type: "INTRODUCES",
  confidence: 1,
  properties: {}
};

function run(
  label: string,
  bag: Array<{
    entity: typeof pep | typeof typing;
    score: number;
    source: string;
    relationship?: typeof introduces;
  }>,
  query: string,
  answer: string
) {
  const understanding =
    understandQuery(query);

  const selected =
    selectAnswerEvidence(understanding, bag as never);

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
      maxEvidence: 10,
      inputCount: bag.length,
      retainedCount: selected.length,
      truncated: false
    },
    config: { maxEvidence: 10 }
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

  console.log(label, {
    selected: selected.map(item => ({
      entity: item.entity.id,
      label: item.entity.label,
      rel: item.relationship
        ? `${item.relationship.from}|${item.relationship.type}|${item.relationship.to}`
        : null
    })),
    attr,
    status: outcome.result.trace.meta?.verificationStatus,
    confidence: outcome.result.confidence,
    steps: outcome.result.trace.steps
      .map(step => step.description)
      .filter(line => /Verification:|attribution/i.test(line))
  });
}

const query =
  "What did PEP-484 introduce?";

const answerFull =
  "Type Hints introduced Typing.";

const answerShort =
  "Typing";

const answerFeature =
  "PEP-484 introduces the Typing feature.";

run(
  "subject-keyed",
  [
    { entity: pep, score: 1, source: "graph", relationship: introduces },
    { entity: typing, score: 1, source: "graph", relationship: introduces },
    { entity: pep, score: 1, source: "graph" },
    { entity: typing, score: 1, source: "graph" }
  ],
  query,
  answerFull
);

run(
  "object-keyed-only",
  [
    { entity: typing, score: 1, source: "graph", relationship: introduces }
  ],
  query,
  answerFull
);

run(
  "object-keyed-short",
  [
    { entity: typing, score: 1, source: "graph", relationship: introduces }
  ],
  query,
  answerShort
);

run(
  "subject-keyed-feature-suffix",
  [
    { entity: pep, score: 1, source: "graph", relationship: introduces },
    { entity: typing, score: 1, source: "graph", relationship: introduces },
    { entity: pep, score: 1, source: "graph" },
    { entity: typing, score: 1, source: "graph" }
  ],
  query,
  answerFeature
);

run(
  "label-is-PEP-id-only",
  [
    {
      entity: {
        ...pep,
        label: "PEP-484",
        properties: { pep: "484" }
      },
      score: 1,
      source: "graph",
      relationship: introduces
    },
    { entity: typing, score: 1, source: "graph", relationship: introduces },
    {
      entity: {
        ...pep,
        label: "PEP-484",
        properties: { pep: "484" }
      },
      score: 1,
      source: "graph"
    },
    { entity: typing, score: 1, source: "graph" }
  ],
  query,
  answerFull
);
