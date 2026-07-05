import type {

  PerformanceMetrics

} from "./performance-metrics.js";

export interface PerformanceReport {

  metrics: PerformanceMetrics;

  cacheEnabled: boolean;

  batchingEnabled: boolean;

}