import { app, httpServer, io } from "../socket/socketServer.js";
import { createAdapter } from "@socket.io/redis-adapter";
import { createClient } from "redis";

const redisUrl = process.env.REDIS_URL;

if (redisUrl) {
  const pubClient = createClient({ url: redisUrl });
  const subClient = pubClient.duplicate();

  await Promise.all([pubClient.connect(), subClient.connect()]);
  io.adapter(createAdapter(pubClient, subClient));
}

export default httpServer;
