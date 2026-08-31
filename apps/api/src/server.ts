import "./config/load-env.js";

import { createApp } from "./app.js";

const PORT = Number(process.env.PORT ?? 3000);

const app = createApp();

app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 API running on port ${PORT}`);
});
