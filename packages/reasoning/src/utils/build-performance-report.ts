import type {

  PerformanceMetrics

} from "../types/performance-metrics.js";

import type {

  PerformanceReport

} from "../types/performance-report.js";

export function buildPerformanceReport(

  metrics: PerformanceMetrics,

  cacheEnabled = true,

  batchingEnabled = true

): PerformanceReport {

  return {

    metrics,

    cacheEnabled,

    batchingEnabled

  };

}