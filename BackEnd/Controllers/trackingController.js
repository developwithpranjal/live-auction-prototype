import Auction from "../Models/Auction.js";

// @desc    Advance delivery status (for dummy prototype purposes)
// @route   POST /api/tracking/:auctionId/advance
// @access  Private
export const advanceTrackingStatus = async (req, res) => {
  try {
    const { auctionId } = req.params;
    
    const auction = await Auction.findById(auctionId);
    if (!auction) {
      return res.status(404).json({ message: "Auction not found" });
    }

    if (!auction.isPaid) {
      return res.status(400).json({ message: "Cannot track an unpaid order" });
    }

    const statuses = ['processing', 'shipped', 'out_for_delivery', 'delivered'];
    const currentIndex = statuses.indexOf(auction.deliveryStatus || 'processing');
    
    if (currentIndex === -1 || currentIndex === statuses.length - 1) {
      return res.json({ message: "Order is already delivered", deliveryStatus: auction.deliveryStatus });
    }

    // Advance to next status
    auction.deliveryStatus = statuses[currentIndex + 1];
    await auction.save();

    res.json({ message: "Status updated", deliveryStatus: auction.deliveryStatus });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error advancing tracking status" });
  }
};
