import type {

  PerformanceMetrics

} from "../types/performance-metrics.js";

export function endPerformance(

  startTime: number

): PerformanceMetrics {

  const endTime = Date.now();

  return {

    startTime,

    endTime,

    duration:

      endTime - startTime

  };

}