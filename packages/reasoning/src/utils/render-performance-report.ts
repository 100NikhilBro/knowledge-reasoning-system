import type {

  PerformanceReport

} from "../types/performance-report.js";

export function renderPerformanceReport(

  report: PerformanceReport

): string {

  return [

    `Duration: ${report.metrics.duration} ms`,

    `Cache: ${report.cacheEnabled ? "ON" : "OFF"}`,

    `Batching: ${report.batchingEnabled ? "ON" : "OFF"}`

  ].join("\n");

}