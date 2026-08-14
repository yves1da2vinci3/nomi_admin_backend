import http from "node:http";
import { loadEnv } from "./config/env.js";
import { createApp } from "./app/create-app.js";
import { attachStudioChatSocket } from "./socket/studio-chat-socket.js";
import { connectRedis } from "./lib/redis.js";
import { startB2bScheduler } from "./jobs/b2b-scheduler.js";

const env = loadEnv();
const app = createApp(env);

await connectRedis();
startB2bScheduler(env);

const httpServer = http.createServer(app);
attachStudioChatSocket(httpServer, env);

const port = env.PORT;
httpServer.listen(port, () => {
  console.log(`[admin_backend] listening on :${port}`);
});
