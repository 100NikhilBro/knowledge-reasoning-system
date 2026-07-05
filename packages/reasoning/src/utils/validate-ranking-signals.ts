import type {

  RankingSignals

} from "../types/ranking-signals.js";

export function validateRankingSignals(

  signals: RankingSignals

): boolean {

  const total =

    Object.values(

      signals

    ).reduce(

      (a, b) => a + b,

      0

    );

  return Math.abs(

    total - 1

  ) < 0.0001;

}