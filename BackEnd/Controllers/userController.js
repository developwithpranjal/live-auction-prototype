import User from "../Models/User.js";

// @desc    Toggle auction in wishlist
// @route   POST /api/users/wishlist
// @access  Private
export const toggleWishlist = async (req, res) => {
  try {
    const { auctionId } = req.body;
    if (!auctionId) {
      return res.status(400).json({ message: "Auction ID is required" });
    }

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const isWishlisted = user.wishlist.includes(auctionId);

    if (isWishlisted) {
      // Remove from wishlist
      user.wishlist = user.wishlist.filter(id => id.toString() !== auctionId.toString());
    } else {
      // Add to wishlist
      user.wishlist.push(auctionId);
    }

    await user.save();

    res.status(200).json({
      message: isWishlisted ? "Removed from wishlist" : "Added to wishlist",
      wishlist: user.wishlist
    });
  } catch (error) {
    console.error("Toggle wishlist error:", error);
    res.status(500).json({ message: "Server error toggling wishlist" });
  }
};

// @desc    Get user wishlist
// @route   GET /api/users/wishlist
// @access  Private
export const getWishlist = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).populate("wishlist");
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.status(200).json({
      wishlist: user.wishlist
    });
  } catch (error) {
    console.error("Get wishlist error:", error);
    res.status(500).json({ message: "Server error fetching wishlist" });
  }
};
