import { io } from "../socket/socketServer.js";
import { createAdapter } from "@socket.io/redis-adapter";
import { createClient } from "redis";

const redisUrl = process.env.REDIS_URL;

if (redisUrl) {
  const pubClient = createClient({ url: redisUrl });
  const subClient = pubClient.duplicate();

  pubClient.on("error", (error) => {
    console.error("Redis Pub Client Error:", error);
  });

  subClient.on("error", (error) => {
    console.error("Redis Sub Client Error:", error);
  });

  await Promise.all([pubClient.connect(), subClient.connect()]);

  io.adapter(createAdapter(pubClient, subClient));

  console.log("Socket.IO Redis adapter connected");
} else {
  console.log("REDIS_URL not configured");
}
