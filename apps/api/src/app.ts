import "@knowledge/shared";

import express, { Application } from "express";

const app:Application = express();

app.use(express.json());

app.get("/health", (_, res) => {
  res.json({
    status: "ok",
    service: "Knowledge Reasoning API"
  });
});

export default app;