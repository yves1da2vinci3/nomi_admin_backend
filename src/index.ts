import { loadEnv } from "./config/env.js";
import { createApp } from "./app/create-app.js";

const env = loadEnv();
const app = createApp(env);

const port = env.PORT;
app.listen(port, () => {
  console.log(`[admin_backend] listening on :${port}`);
});
