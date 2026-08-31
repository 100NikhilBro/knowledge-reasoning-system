import "./config/load-env.js";

import { createApp } from "./app.js";

const PORT = 3000;

const app = createApp();

app.listen(PORT, () => {
  console.log(`🚀 API running on http://localhost:${PORT}`);
});
