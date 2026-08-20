import Auction from "../Models/Auction.js";
import Bid from "../Models/Bid.js";

/**
 * Setup all Socket.io handlers for the auction system.
 *
 * ── SOCKET ROOM ARCHITECTURE ───────────────────────────────────────────────
 * Each auction gets its own Socket.io "room" named `auction:<auctionId>`.
 * This is how Socket.io organizes targeted broadcasts:
 *
 *   1. User opens Auction Detail page
 *   2. Frontend emits `join_auction` with the auction ID
 *   3. Server calls socket.join(`auction:<id>`) — adding this connection to the room
 *   4. When a bid is placed, server broadcasts `bid_update` to the ROOM
 *      → Every browser in that room gets the update instantly
 *   5. On page unmount, frontend emits `leave_auction` → socket.leave(room)
 *
 * No polling, no DB fetching — pure push.
 *
 * ── ATOMIC BID LOGIC ───────────────────────────────────────────────────────
 * Race condition: Two users click "Place Bid" at exactly the same time.
 * Without locking, both reads see currentPrice = 1000, both write 1100 → only
 * one bid "wins" but both think they succeeded — data corruption.
 *
 * Fix: MongoDB findOneAndUpdate with a CONDITIONAL filter on currentPrice:
 *
 *   { _id: auctionId, currentPrice: { $lt: newBid }, status: 'live' }
 *
 * MongoDB processes this atomically:
 *   - Thread A: currentPrice=1000, newBid=1100 → condition matches → updates to 1100 ✅
 *   - Thread B: currentPrice=1000, newBid=1100 → condition FAILS (1100 is not < 1100) → returns null ❌
 *
 * Thread B sees null → rejected. No Redis, no distributed locks needed for a prototype.
 * TODO (production): For very high traffic, use Redis with Lua scripts for true distributed locking.
 */
export const setupAuctionSocket = (io) => {
  io.on("connection", (socket) => {
    console.log(`🔌 Socket connected: ${socket.id}`);

    // ── join_auction ────────────────────────────────────────────────────────
    // Client joins the room for a specific auction to receive bid updates.
    socket.on("join_auction", ({ auctionId }) => {
      const room = `auction:${auctionId}`;
      socket.join(room);
      console.log(`👋 ${socket.id} joined room: ${room}`);
    });

    // ── leave_auction ───────────────────────────────────────────────────────
    socket.on("leave_auction", ({ auctionId }) => {
      const room = `auction:${auctionId}`;
      socket.leave(room);
      console.log(`👋 ${socket.id} left room: ${room}`);
    });

    // ── place_bid ───────────────────────────────────────────────────────────
    // The core real-time bidding handler.
    socket.on("place_bid", async ({ auctionId, amount, userId, userName }) => {
      try {
        const newBid = Number(amount);

        if (!auctionId || !userId || isNaN(newBid) || newBid <= 0) {
          socket.emit("bid_error", { message: "Invalid bid data" });
          return;
        }

        // ── Step 1: Check auction exists and is live ──────────────────────
        const auction = await Auction.findById(auctionId);
        if (!auction) {
          socket.emit("bid_error", { message: "Auction not found" });
          return;
        }
        if (auction.status !== "live") {
          socket.emit("bid_error", {
            message: `Auction is ${auction.status}, not accepting bids`,
          });
          return;
        }

        // Prevent seller from bidding on their own item
        if (auction.seller.toString() === userId.toString()) {
          socket.emit("bid_error", {
            message: "Sellers cannot bid on their own auctions",
          });
          return;
        }

        // ── Step 2: Validate bid amount ────────────────────────────────────
        const minBid = auction.currentPrice + auction.bidIncrement;
        if (newBid < minBid) {
          socket.emit("bid_error", {
            message: `Bid must be at least ₹${minBid} (current ₹${auction.currentPrice} + increment ₹${auction.bidIncrement})`,
          });
          return;
        }

        const maxBid = auction.currentPrice * 1.5;
        if (newBid > maxBid) {
          socket.emit("bid_error", {
            message: `Custom bid cannot exceed 50% of the current price (Max allowed: ₹${maxBid})`,
          });
          return;
        }

        // ── Step 2.5: Validate User Wallet Balance ─────────────────────────
        const User = (await import("../Models/User.js")).default;
        const bidder = await User.findById(userId);
        if (!bidder || bidder.walletBalance < newBid) {
          socket.emit("bid_error", {
            message: "Insufficient wallet balance to place this bid.",
          });
          return;
        }

        // ── Step 3: Atomic update — the key to preventing race conditions ──
        // The condition { currentPrice: { $lt: newBid } } ensures:
        // Only one concurrent bid wins. The losing bid sees null.
        const previousBidderId = auction.highestBidder?.toString();

        const updated = await Auction.findOneAndUpdate(
          {
            _id: auctionId,
            status: "live",
            currentPrice: { $lt: newBid }, // Atomic condition
          },
          {
            $set: {
              currentPrice: newBid,
              highestBidder: userId,
            },
          },
          { new: true }
        );

        if (!updated) {
          // Another bid won the race — this bid is stale or invalid
          socket.emit("bid_error", {
            message:
              "Your bid was too slow — someone else bid first. Please try again.",
          });
          return;
        }

        // ── Step 4: Record the bid in DB ───────────────────────────────────
        const bidDoc = await Bid.create({
          auction: auctionId,
          bidder: userId,
          amount: newBid,
        });

        // ── Step 5: Broadcast bid_update to EVERYONE in the room ──────────
        const bidPayload = {
          _id: bidDoc._id,
          auctionId,
          amount: newBid,
          bidder: { _id: userId, name: userName },
          createdAt: bidDoc.createdAt,
        };

        // All sockets in the room (including the bidder) get this event
        io.to(`auction:${auctionId}`).emit("bid_update", {
          currentPrice: newBid,
          bid: bidPayload,
        });

        // ── Step 6: Notify the PREVIOUS highest bidder they've been outbid ─
        // We need to find their socket. We look up sockets in the room and
        // match by the userId stored in socket.data.
        // NOTE: This works for prototype (single server). In production with
        // multiple servers, use Redis adapter + room-based targeting.
        // TODO (production): Use socket.to(userRoom).emit() with user-specific rooms.
        if (previousBidderId && previousBidderId !== userId.toString()) {
          // Emit outbid to all sockets in the room that belong to the previous bidder
          const socketsInRoom = await io
            .in(`auction:${auctionId}`)
            .fetchSockets();

          for (const s of socketsInRoom) {
            if (s.data?.userId?.toString() === previousBidderId) {
              s.emit("outbid", {
                newAmount: newBid,
                newBidder: userName,
              });
            }
          }
        }

        console.log(
          `💰 Bid placed on auction ${auctionId}: ₹${newBid} by ${userName}`
        );
      } catch (error) {
        console.error("Bid placement error:", error);
        socket.emit("bid_error", { message: "Server error placing bid" });
      }
    });

    // ── Store userId on socket for outbid targeting ────────────────────────
    socket.on("authenticate", ({ userId }) => {
      socket.data.userId = userId;
    });

    // ── WebRTC Signaling & Live Chat ────────────────────────────────────────

    // 1. Chat Message
    socket.on("chat_message", ({ auctionId, message, user }) => {
      const room = `auction:${auctionId}`;
      io.to(room).emit("chat_message", { message, user, timestamp: new Date() });
    });

    // 2. WebRTC: Broadcaster joins and signals readiness
    socket.on("broadcaster_joined", ({ auctionId }) => {
      socket.join(`auction:${auctionId}`);
      // Notify everyone in the room that the stream is starting/available
      socket.broadcast.to(`auction:${auctionId}`).emit("broadcaster_ready");
    });

    // 3. WebRTC: Viewer joins and asks for video
    socket.on("viewer_joined", ({ auctionId }) => {
      socket.join(`auction:${auctionId}`);
      // Tell the broadcaster (and everyone else) that a viewer joined. 
      // The broadcaster will catch this and send an offer to this specific socket.id
      socket.broadcast.to(`auction:${auctionId}`).emit("viewer_joined", socket.id);
    });

    // 4. WebRTC: Offer from Broadcaster to Viewer
    socket.on("offer", ({ auctionId, viewerId, offer }) => {
      // Send offer directly to the viewer's socket
      socket.to(viewerId).emit("offer", { broadcasterId: socket.id, offer });
    });

    // 5. WebRTC: Answer from Viewer back to Broadcaster
    socket.on("answer", ({ auctionId, broadcasterId, answer }) => {
      socket.to(broadcasterId).emit("answer", { viewerId: socket.id, answer });
    });

    // 6. WebRTC: ICE Candidates exchange
    socket.on("ice_candidate", ({ auctionId, targetId, candidate }) => {
      socket.to(targetId).emit("ice_candidate", { senderId: socket.id, candidate });
    });

    socket.on("disconnect", () => {
      console.log(`🔌 Socket disconnected: ${socket.id}`);
    });
  });
};
