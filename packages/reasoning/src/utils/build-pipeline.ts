import type {

  Pipeline

} from "../types/pipeline.js";

export function buildPipeline(): Pipeline {

  return {

    steps: [

      {

        name: "rewrite"

      },

      {

        name: "traversal"

      },

      {

        name: "verification"

      },

      {

        name: "ranking"

      },

      {

        name: "compression"

      },

      {

        name: "optimization"

      },

      {

        name: "explanation"

      },

      {

        name: "performance"

      }

    ]

  };

}