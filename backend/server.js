import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import jwt from "jsonwebtoken";
import { createServer } from "http";
import { Server } from "socket.io";

import connectDB from "./config/db.js";
import authRoutes from "./routes/authRoutes.js";
import messageRoutes from "./routes/messageRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import friendRoutes from "./routes/friendRoutes.js";

import Message from "./models/Message.js";
import User from "./models/User.js";
import Friendship from "./models/Friendship.js";

dotenv.config();

const app = express();

const PORT = process.env.PORT || 5000;

const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: "http://localhost:5173",
  },
});

app.use(cors());
app.use(express.json());

app.use("/api/auth", authRoutes);
app.use("/api/messages", messageRoutes);
app.use("/api/users", userRoutes);
app.use("/api/friends", friendRoutes);

app.get("/", (req, res) => {
  res.send("Chime backend is running!");
});

/*
  Socket.IO authentication
*/
io.use((socket, next) => {
  try {
    const token = socket.handshake.auth.token;

    if (!token) {
      return next(new Error("Authentication required"));
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    socket.user = decoded;

    next();
  } catch (error) {
    next(new Error("Invalid or expired token"));
  }
});

/*
  Socket.IO connections
*/
io.on("connection", (socket) => {
  console.log("Authenticated socket connected:", socket.id);
  console.log("User ID:", socket.user.userId);

  /*
    Send message
  */
  socket.on("send_message", async (data) => {
    try {
      const { content, recipient, room } = data;

      if (!content || !content.trim()) {
        return;
      }

      const sender = await User.findById(socket.user.userId);

      if (!sender || sender.isDeleted) {
        console.error("Message sender no longer exists");
        return;
      }

      /*
        DM message
      */
      if (recipient) {
        const recipientUser = await User.findById(recipient);

        if (!recipientUser || recipientUser.isDeleted) {
          console.error("Message recipient no longer exists");
          return;
        }

        if (recipient === socket.user.userId) {
          console.error("User cannot message themselves");
          return;
        }

        /*
          Only friends can send DMs.
        */
        const friendship = await Friendship.findOne({
          status: "accepted",
          $or: [
            {
              requester: socket.user.userId,
              recipient,
            },
            {
              requester: recipient,
              recipient: socket.user.userId,
            },
          ],
        });

        if (!friendship) {
          console.error("Users are not friends");
          return;
        }

        const message = await Message.create({
          sender: socket.user.userId,
          senderUsername: sender.username,
          recipient,
          content: content.trim(),
          room: null,
        });

        await message.populate("sender", "username");
        await message.populate("recipient", "username");

        /*
          Send the DM only to the two users involved.
        */
        io.emit("new_message", message);

        return;
      }

      /*
        Public room message
      */
      const message = await Message.create({
        sender: socket.user.userId,
        senderUsername: sender.username,
        recipient: null,
        content: content.trim(),
        room: room || "general",
      });

      await message.populate("sender", "username");

      io.emit("new_message", message);
    } catch (error) {
      console.error("Socket message error:", error);
    }
  });

  socket.on("disconnect", () => {
    console.log("Socket disconnected:", socket.id);
  });
});

connectDB();

httpServer.listen(PORT, () => {
  console.log(`Chime backend running on port ${PORT}`);
});
