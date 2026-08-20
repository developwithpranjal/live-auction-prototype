import Cart from "../Models/Cart.js";
import Auction from "../Models/Auction.js";

// @desc    Get user cart
// @route   GET /api/cart
// @access  Private
export const getCart = async (req, res) => {
  try {
    const userId = req.user._id;
    let cart = await Cart.findOne({ user: userId }).populate({
      path: "items.auction",
      select: "title images currentPrice status bidIncrement",
    });

    if (!cart) {
      cart = await Cart.create({ user: userId, items: [] });
    }

    res.status(200).json({ cart });
  } catch (error) {
    console.error("Get cart error:", error);
    res.status(500).json({ message: "Server error fetching cart" });
  }
};

// @desc    Add item to cart
// @route   POST /api/cart/:auctionId
// @access  Private
export const addToCart = async (req, res) => {
  try {
    const { auctionId } = req.params;
    const userId = req.user._id;

    const auction = await Auction.findById(auctionId);
    if (!auction) {
      return res.status(404).json({ message: "Auction not found" });
    }

    let cart = await Cart.findOne({ user: userId });
    if (!cart) {
      cart = await Cart.create({ user: userId, items: [] });
    }

    // Check if item is already in cart
    const itemExists = cart.items.find((item) => item.auction.toString() === auctionId.toString());
    if (itemExists) {
      return res.status(400).json({ message: "Item already in cart" });
    }

    cart.items.push({ auction: auctionId });
    await cart.save();

    res.status(200).json({ message: "Added to cart successfully", cart });
  } catch (error) {
    console.error("Add to cart error:", error);
    res.status(500).json({ message: "Server error adding to cart" });
  }
};

// @desc    Remove item from cart
// @route   DELETE /api/cart/:auctionId
// @access  Private
export const removeFromCart = async (req, res) => {
  try {
    const { auctionId } = req.params;
    const userId = req.user._id;

    let cart = await Cart.findOne({ user: userId });
    if (!cart) {
      return res.status(404).json({ message: "Cart not found" });
    }

    cart.items = cart.items.filter((item) => item.auction.toString() !== auctionId.toString());
    await cart.save();

    res.status(200).json({ message: "Removed from cart successfully", cart });
  } catch (error) {
    console.error("Remove from cart error:", error);
    res.status(500).json({ message: "Server error removing from cart" });
  }
};
