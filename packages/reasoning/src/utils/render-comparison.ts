import type {
  ComparisonSummary
} from "../types/comparison-summary.js";

import type {
  StructuredComparisonResult,
  SubjectRelationshipFact
} from "./compare-evidence.js";

function formatFact(
  fact: SubjectRelationshipFact
): string {

  if (fact.type === "PROPOSED_BY" && fact.direction === "outgoing") {
    return `proposed by ${fact.targetLabel}`;
  }

  const verb =
    RELATIONSHIP_VERBS[fact.type] ??
    fact.type.toLowerCase().replace(/_/g, " ");

  if (fact.direction === "outgoing") {
    return `${verb} ${fact.targetLabel}`;
  }

  return `${verb} by ${fact.targetLabel}`;

}

const RELATIONSHIP_VERBS: Record<string, string> = {
  INTRODUCES: "introduces",
  PROPOSED_BY: "proposed",
  ADDRESSES: "addresses",
  RESULTS_IN: "results in",
  IMPLEMENTED_IN: "implemented in"
};

/**
 * Render structured N-way comparison prose.
 */
export function renderStructuredComparison(
  result: StructuredComparisonResult
): string {

  if (result.subjects.length < 2) {
    return "Comparison subjects could not be resolved from the query.";
  }

  if (
    result.perSubject.every(item => !item.supported)
  ) {
    return "Comparison could not be established from grounded relationship evidence.";
  }

  const lines: string[] = [];

  lines.push(
    `Comparison of ${result.subjects.join(", ")}` +
    ` (${result.dimensions.join(", ")}):`
  );

  if (result.common.length > 0) {
    lines.push(
      `Common: ${result.common.map(formatFact).join("; ")}.`
    );
  }

  for (const item of result.perSubject) {
    const heading =
      item.label ?? item.subject;

    if (!item.supported) {
      lines.push(
        `${heading}: insufficient evidence for requested dimensions.`
      );
      continue;
    }

    const facts =
      item.relationships.map(formatFact);

    const propertyBits =
      Object.entries(item.properties)
        .filter(([, value]) =>
          typeof value === "string" ||
          typeof value === "number"
        )
        .map(([key, value]) => `${key}=${String(value)}`);

    const body =
      [...facts, ...propertyBits];

    if (body.length === 0) {
      lines.push(
        `${heading}: insufficient evidence for requested dimensions.`
      );
      continue;
    }

    lines.push(`${heading}: ${body.join("; ")}.`);
  }

  if (result.unsupportedSubjects.length > 0) {
    lines.push(
      `Unsupported subjects: ${result.unsupportedSubjects.join(", ")}.`
    );
  }

  return lines.join("\n");

}

export function renderComparison(
  summary: ComparisonSummary
): string {

  if (summary.structured) {
    return renderStructuredComparison(summary.structured);
  }

  const lines: string[] = [];

  if (summary.common.length) {
    lines.push(
      `Common: ${summary.common.join(", ")}`
    );
  }

  if (summary.leftOnly.length) {
    lines.push(
      `Only Left: ${summary.leftOnly.join(", ")}`
    );
  }

  if (summary.rightOnly.length) {
    lines.push(
      `Only Right: ${summary.rightOnly.join(", ")}`
    );
  }

  return lines.join("\n");

}
