import Auction from "../Models/Auction.js";
import User from "../Models/User.js";

// @desc    Checkout and pay for an won auction
// @route   POST /api/checkout/:auctionId
// @access  Private
export const processCheckout = async (req, res) => {
  try {
    const { auctionId } = req.params;
    const userId = req.user._id;

    const auction = await Auction.findById(auctionId);
    if (!auction) {
      return res.status(404).json({ message: "Auction not found" });
    }

    if (auction.status !== "ended") {
      return res.status(400).json({ message: "Auction has not ended yet" });
    }

    if (!auction.winnerId || auction.winnerId.toString() !== userId.toString()) {
      return res.status(403).json({ message: "You are not the winner of this auction" });
    }

    if (auction.isPaid) {
      return res.status(400).json({ message: "Auction has already been paid for" });
    }

    const user = await User.findById(userId);
    if (user.walletBalance < auction.currentPrice) {
      return res.status(400).json({ message: "Insufficient wallet balance to checkout" });
    }

    // Extract delivery details from request body
    const { address, city, pincode, phone } = req.body;
    if (!address || !city || !pincode || !phone) {
      return res.status(400).json({ message: "Delivery details are incomplete" });
    }

    // Deduct balance and mark as paid
    user.walletBalance -= auction.currentPrice;
    await user.save();

    auction.isPaid = true;
    auction.deliveryDetails = { address, city, pincode, phone };
    await auction.save();

    res.json({ message: "Checkout successful", balance: user.walletBalance, auction });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error during checkout" });
  }
};
