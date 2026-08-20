import Offer from "../Models/Offer.js";
import Auction from "../Models/Auction.js";

// @desc    Create an offer for a live auction
// @route   POST /api/offers
// @access  Private
export const createOffer = async (req, res) => {
  try {
    const { auctionId, amount } = req.body;
    const userId = req.user._id;

    if (!auctionId || !amount) {
      return res.status(400).json({ message: "Auction ID and amount are required" });
    }

    const offerAmount = Number(amount);
    const auction = await Auction.findById(auctionId);

    if (!auction) {
      return res.status(404).json({ message: "Auction not found" });
    }

    if (auction.status !== "live") {
      return res.status(400).json({ message: "You can only make offers on live auctions" });
    }

    if (auction.seller.toString() === userId.toString()) {
      return res.status(400).json({ message: "Sellers cannot make an offer on their own auction" });
    }

    const minOffer = auction.startPrice * 1.3;
    if (offerAmount < minOffer) {
      return res.status(400).json({
        message: `Offer must be at least 30% above the listed start price (₹${minOffer.toFixed(0)})`,
      });
    }

    // Replace any existing pending offer from this buyer for this auction
    const existingOffer = await Offer.findOne({ auction: auctionId, buyer: userId, status: "pending" });
    if (existingOffer) {
      existingOffer.amount = offerAmount;
      await existingOffer.save();
      return res.status(200).json({ message: "Offer updated successfully", offer: existingOffer });
    }

    const newOffer = await Offer.create({
      auction: auctionId,
      buyer: userId,
      amount: offerAmount,
    });

    res.status(201).json({ message: "Offer submitted successfully", offer: newOffer });
  } catch (error) {
    console.error("Create offer error:", error);
    res.status(500).json({ message: "Server error creating offer" });
  }
};

// @desc    Get all offers for an auction (Seller only)
// @route   GET /api/offers/:auctionId
// @access  Private
export const getOffersForAuction = async (req, res) => {
  try {
    const { auctionId } = req.params;
    const userId = req.user._id;

    const auction = await Auction.findById(auctionId);
    if (!auction) {
      return res.status(404).json({ message: "Auction not found" });
    }

    if (auction.seller.toString() !== userId.toString()) {
      return res.status(403).json({ message: "Only the seller can view offers for this auction" });
    }

    const offers = await Offer.find({ auction: auctionId, status: "pending" })
      .populate("buyer", "name email")
      .sort({ amount: -1, createdAt: -1 });

    res.status(200).json({ offers });
  } catch (error) {
    console.error("Get offers error:", error);
    res.status(500).json({ message: "Server error fetching offers" });
  }
};

// @desc    Respond to an offer (Accept/Reject)
// @route   PUT /api/offers/:offerId/respond
// @access  Private
export const respondToOffer = async (req, res) => {
  try {
    const { offerId } = req.params;
    const { action } = req.body; // "accept" or "reject"
    const userId = req.user._id;

    if (!["accept", "reject"].includes(action)) {
      return res.status(400).json({ message: "Invalid action. Must be 'accept' or 'reject'." });
    }

    const offer = await Offer.findById(offerId).populate("auction");
    if (!offer) {
      return res.status(404).json({ message: "Offer not found" });
    }

    if (offer.status !== "pending") {
      return res.status(400).json({ message: `Offer is already ${offer.status}` });
    }

    const auction = offer.auction;
    if (auction.seller.toString() !== userId.toString()) {
      return res.status(403).json({ message: "Only the seller can respond to offers" });
    }

    if (auction.status !== "live") {
      return res.status(400).json({ message: "Auction is no longer live" });
    }

    if (action === "reject") {
      offer.status = "rejected";
      await offer.save();
      return res.status(200).json({ message: "Offer rejected successfully", offer });
    }

    // If Accept:
    offer.status = "accepted";
    await offer.save();

    // Reject all other pending offers for this auction
    await Offer.updateMany(
      { auction: auction._id, _id: { $ne: offerId }, status: "pending" },
      { $set: { status: "rejected" } }
    );

    // End auction and set winner
    auction.status = "ended";
    auction.winnerId = offer.buyer;
    auction.currentPrice = offer.amount;
    await auction.save();

    // Emit socket event to notify all connected clients
    const io = req.app.get("io");
    if (io) {
      io.to(`auction:${auction._id}`).emit("auction_ended", {
        winner: offer.buyer,
        finalPrice: offer.amount,
      });
    }

    res.status(200).json({ message: "Offer accepted. Auction ended.", offer, auction });
  } catch (error) {
    console.error("Respond to offer error:", error);
    res.status(500).json({ message: "Server error responding to offer" });
  }
};
