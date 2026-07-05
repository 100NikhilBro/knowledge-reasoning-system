// import type {

//   ReasoningPipeline

// } from "../types/reasoning-pipeline.js";




// export function buildReasoningPipeline(): ReasoningPipeline {

//   return {

//     stages: [

//       "queryRewrite",

//       "traversal",

//       "ranking",

//       "verification",

//       "compression",

//       "optimization",

//       "confidence",

//       "explanation"

//     ]

//   };

// }


import type { ReasoningPipeline } from "../types/reasoning-pipeline.js";

export function buildReasoningPipeline(): ReasoningPipeline {
  return {
    steps: [
      { name: "queryRewrite" },
      { name: "traversal" },
      { name: "ranking" },
      { name: "verification" },
      { name: "compression" },
      { name: "optimization" },
      { name: "confidence" },
      { name: "explanation" }
    ]
  };
}