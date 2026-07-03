import "@knowledge/shared";

import express from "express";

const app = express();

app.use(express.json());

app.get("/health", (_, res) => {
  res.json({
    status: "ok",
    service: "Knowledge Reasoning API"
  });
});

export default app;