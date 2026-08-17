import cron from "node-cron";
import Auction from "../Models/Auction.js";
import Bid from "../Models/Bid.js";

/**
 * Auction Status Cron — runs every 15 seconds.
 *
 * Two jobs:
 * 1. upcoming → live:  when startTime <= now < endTime
 * 2. live → ended:     when endTime <= now
 *                      Also sets winnerId from the highest bid.
 *
 * TODO (production): Move this into a dedicated worker process or
 * use a queue (Bull/BullMQ) so it doesn't block the main server thread.
 */
export const startAuctionCron = (io) => {
  // Run every 15 seconds
  cron.schedule("*/15 * * * * *", async () => {
    const now = new Date();

    try {
      // ── 1. Activate upcoming auctions ─────────────────────────────────────
      const activated = await Auction.updateMany(
        {
          status: "upcoming",
          startTime: { $lte: now },
          endTime: { $gt: now },
        },
        { $set: { status: "live" } }
      );

      if (activated.modifiedCount > 0) {
        console.log(`⏰ Cron: ${activated.modifiedCount} auction(s) → live`);
      }

      // ── 2. End live auctions ───────────────────────────────────────────────
      const toEnd = await Auction.find({
        status: "live",
        endTime: { $lte: now },
      });

      for (const auction of toEnd) {
        // Find the highest bid for this auction
        const highestBid = await Bid.findOne({ auction: auction._id })
          .sort({ amount: -1 })
          .populate("bidder", "name email");

        const winnerId = highestBid ? highestBid.bidder._id : null;

        auction.status = "ended";
        auction.winnerId = winnerId;
        await auction.save();

        console.log(
          `⏰ Cron: Auction "${auction.title}" ended. Winner: ${
            highestBid ? highestBid.bidder.name : "No bids"
          }`
        );

        // Notify everyone watching this auction via Socket.io
        // io is passed in from server.js so we can broadcast here.
        if (io) {
          io.to(`auction:${auction._id}`).emit("auction_ended", {
            auctionId: auction._id,
            winner: highestBid
              ? {
                  _id: highestBid.bidder._id,
                  name: highestBid.bidder.name,
                }
              : null,
            finalPrice: auction.currentPrice,
          });
        }
      }

      if (toEnd.length > 0) {
        console.log(`⏰ Cron: ${toEnd.length} auction(s) → ended`);
      }
    } catch (error) {
      console.error("❌ Cron job error:", error.message);
    }
  });

  console.log("⏰ Auction status cron started (every 15 seconds)");
};
