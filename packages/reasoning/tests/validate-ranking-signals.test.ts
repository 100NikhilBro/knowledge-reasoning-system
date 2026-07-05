import {

  describe,
  expect,
  it

} from "vitest";

import {

  DEFAULT_RANKING_SIGNALS

} from "../src/utils/default-ranking-signals.js";

import {

  validateRankingSignals

} from "../src/utils/validate-ranking-signals.js";

describe(

  "Ranking Signals",

  () => {

    it(

      "weights should sum to one",

      () => {

        expect(

          validateRankingSignals(

            DEFAULT_RANKING_SIGNALS

          )

        ).toBe(

          true

        );

      }

    );

  }

);