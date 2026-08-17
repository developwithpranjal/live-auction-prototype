import Bid from "../Models/Bid.js";

// @desc    Get bid history for an auction
// @route   GET /api/bids/:auctionId
// @access  Public
export const getBidHistory = async (req, res) => {
  try {
    const bids = await Bid.find({ auction: req.params.auctionId })
      .populate("bidder", "name")
      .sort({ createdAt: -1 })
      .limit(100);

    res.status(200).json({ bids });
  } catch (error) {
    console.error("Get bid history error:", error);
    res.status(500).json({ message: "Server error fetching bids" });
  }
};
