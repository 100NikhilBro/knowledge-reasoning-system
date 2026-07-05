import type {

  PerformanceMetrics

} from "../types/performance-metrics.js";

export function buildPerformanceSummary(

  metrics: PerformanceMetrics

): string {

  return `Execution completed in ${metrics.duration} ms.`;

}