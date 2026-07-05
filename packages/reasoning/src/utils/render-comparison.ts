import type {
  ComparisonSummary
} from "../types/comparison-summary.js";

export function renderComparison(

  summary: ComparisonSummary

): string {

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