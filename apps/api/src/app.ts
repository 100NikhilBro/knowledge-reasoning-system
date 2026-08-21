// import "@knowledge/shared";

// import express, { Application } from "express";

// const app:Application = express();

// app.use(express.json());

// app.get("/health", (_, res) => {
//   res.json({
//     status: "ok",
//     service: "Knowledge Reasoning API"
//   });
// });

// export default app;


import "@knowledge/shared";

import express, {
  type Application
} from "express";

import {
  DefaultReasoningEngine
} from "@knowledge/reasoning";

import {
  RedisSessionStateStore
} from "@knowledge/working-memory";

const app: Application =
  express();

app.use(
  express.json()
);


const sessionStateStore =
  new RedisSessionStateStore();

const reasoningEngine =
  new DefaultReasoningEngine(

    undefined,
    undefined,
    undefined,
    undefined,
    undefined,

    sessionStateStore

  );


app.get(
  "/health",
  (_, res) => {

    res.json({

      status:
        "ok",

      service:
        "Knowledge Reasoning API"

    });

  }
);


app.post(
  "/reason",
  async (req, res) => {

    try {

      const result =
        await reasoningEngine.reason({

          query:
            req.body.query,

          topK:
            req.body.topK,

          sessionId:
            req.body.sessionId

        });

      res.json(result);

    } catch (error) {

      console.error(
        "Reasoning failed:",
        error
      );

      res.status(500).json({

        error:
          "Reasoning failed"

      });

    }

  }
);


export default app;