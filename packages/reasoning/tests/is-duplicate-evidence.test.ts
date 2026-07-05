import {

  describe,
  expect,
  it

} from "vitest";

import {

  isDuplicateEvidence

} from "../src/utils/is-duplicate-evidence.js";

describe(

  "Duplicate Evidence",

  () => {

    it(

      "detects duplicates",

      () => {

        const first = {

          entity: {

            id: "1",

            type: "Proposal",

            label: "PEP-484",

            source: "pep.md",

            confidence: 1,

            properties: {}

          },

          score: 0.8,

          source: "graph"

        };

        const second = {

          entity: {

            id: "1",

            type: "Proposal",

            label: "PEP-484",

            source: "pep.md",

            confidence: 1,

            properties: {}

          },

          score: 0.5,

          source: "graph"

        };

        expect(

          isDuplicateEvidence(

            first,

            second

          )

        ).toBe(

          true

        );

      }

    );

    it(

      "detects different evidence",

      () => {

        const first = {

          entity: {

            id: "1",

            type: "Proposal",

            label: "PEP-484",

            source: "pep.md",

            confidence: 1,

            properties: {}

          },

          score: 0.8,

          source: "graph"

        };

        const second = {

          entity: {

            id: "2",

            type: "Proposal",

            label: "PEP-695",

            source: "pep695.md",

            confidence: 1,

            properties: {}

          },

          score: 0.5,

          source: "graph"

        };

        expect(

          isDuplicateEvidence(

            first,

            second

          )

        ).toBe(

          false

        );

      }

    );

  }

);