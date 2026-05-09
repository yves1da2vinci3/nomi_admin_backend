import http from "node:http";
import { loadEnv } from "./config/env.js";
import { createApp } from "./app/create-app.js";
import { attachStudioChatSocket } from "./socket/studio-chat-socket.js";
import { connectRedis } from "./lib/redis.js";

const env = loadEnv();
const app = createApp(env);

await connectRedis();

const httpServer = http.createServer(app);
attachStudioChatSocket(httpServer, env);

const port = env.PORT;
httpServer.listen(port, () => {
  console.log(`[admin_backend] listening on :${port}`);
});
