import "dotenv/config";
import http from "http";
import { Server } from "socket.io";
import app from "./app.js";
import connectDB from "./Config/db.js";
import { startAuctionCron } from "./jobs/auctionStatusCron.js";
import { setupAuctionSocket } from "./sockets/auctionSocket.js";

const PORT = process.env.PORT || 5000;

// ── HTTP Server ───────────────────────────────────────────────────────────────
const server = http.createServer(app);

// ── Socket.io ─────────────────────────────────────────────────────────────────
// Socket.io is attached to the same HTTP server — important for same-port
// operation (no separate WS port needed for prototype).
const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || "http://localhost:5173",
    methods: ["GET", "POST"],
    credentials: true,
  },
});

// Wire all auction socket events (join, bid, leave, outbid)
setupAuctionSocket(io);

// ── Start ─────────────────────────────────────────────────────────────────────
const start = async () => {
  await connectDB();
  server.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    // Start cron AFTER DB is connected and io is ready
    startAuctionCron(io);
  });
};

start();
