import {
  describe,
  expect,
  it
} from "vitest";

import type {
  RankedEvidence
} from "../src/types/ranked-evidence.js";

describe(

  "Ranked Evidence",

  () => {

    it(

      "stores ranking metadata",

      () => {

        const evidence: RankedEvidence = {

          entity: {

            id: "1",

            type: "Proposal",

            label: "PEP",

            source: "pep.md",

            confidence: 1,

            properties: {}

          },

          source: "graph",

          score: 0.95,

          ranking: {

            retrieval: 0.6,

            trust: 0.2,

            confidence: 0.2,

            final: 1

          }

        };

        expect(

          evidence.ranking.final

        ).toBe(1);

      }

    );

  }

);