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
  verifyAnswerAgainstIntent
} from "../src/utils/answer-intent-verification.js";

import {
  DefaultAnswerVerifier
} from "../src/services/answer-verifier.service.js";

const pep = {
  id: "proposal:PEP-484",
  type: "Proposal",
  label: "Type Hints",
  source: "x",
  confidence: 1,
  properties: { pep: "484", title: "Type Hints" }
};

const typing = {
  id: "feature:typing",
  type: "Feature",
  label: "Typing",
  source: "x",
  confidence: 1,
  properties: {}
};

const introduces = {
  from: pep.id,
  to: typing.id,
  type: "INTRODUCES",
  confidence: 1,
  properties: {}
};

function ev(
  entity: typeof pep,
  relationship?: typeof introduces
) {
  return {
    entity,
    score: 1,
    source: "graph",
    ...(relationship ? { relationship } : {})
  };
}

const bag = [
  ev(pep, introduces),
  ev(typing, introduces),
  ev(pep),
  ev(typing)
];

const NOUN_PHRASE =
  String.raw`[A-Za-z][A-Za-z0-9_-]*(?:\s+(?!and\b)[A-Za-z][A-Za-z0-9_-]*){0,5}`;

const CLAUSE_STOP =
  String.raw`(?=\s+and\s+(?:introduced|introduces|addresses|addressed|was proposed|proposed by|resulted|implemented)|[.,;]|$)`;

const INTRODUCES_RE =
  new RegExp(
    String.raw`\b(${NOUN_PHRASE})\s+(?:introduces|introduced|introduce)\s+(${NOUN_PHRASE})${CLAUSE_STOP}`,
    "gi"
  );

function ctx(
  query: string
) {
  const understanding =
    understandQuery(query);

  const selected =
    selectAnswerEvidence(understanding, bag);

  return {
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
}

const queries = [
  "What did PEP-484 introduce?",
  "How is PEP-484 connected to Typing?"
];

const answers = [
  "Type Hints introduced Typing.",
  "Typing",
  "PEP-484 introduces the Typing feature.",
  "PEP-484 introduces Typing.",
  "Type Hints introduces the Typing feature.",
  "PEP-484 introduces the Typing feature"
];

for (const query of queries) {
  const context =
    ctx(query);

  console.log("\n====", query);
  console.log(
    "selected",
    context.evidence
      .filter(item => item.relationship)
      .map(item => item.relationship)
  );

  for (const answer of answers) {
    INTRODUCES_RE.lastIndex = 0;

    const matches =
      [...answer.matchAll(INTRODUCES_RE)].map(match => ({
        subject: match[1],
        object: match[2]
      }));

    const attr =
      relationshipAttributionIsGrounded(answer, context);

    const intent =
      verifyAnswerAgainstIntent(answer, context);

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

    console.log({
      answer,
      matches,
      attr,
      intentStatus: intent.semantics.status,
      intentReasons: intent.semantics.reasons,
      final:
        outcome.result.trace.meta?.verificationStatus,
      confidence: outcome.result.confidence
    });
  }
}
