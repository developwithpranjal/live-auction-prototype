import Auction from "../Models/Auction.js";
import Bid from "../Models/Bid.js";

// Helper to lazily update statuses of all auctions based on current time
const lazyUpdateAuctionStatuses = async () => {
  const now = new Date();
  try {
    await Auction.updateMany(
      { status: "upcoming", startTime: { $lte: now }, endTime: { $gt: now } },
      { $set: { status: "live" } }
    );
    await Auction.updateMany(
      { status: "live", endTime: { $lte: now } },
      { $set: { status: "ended" } }
    );
  } catch (error) {
    console.error("Lazy status update failed", error);
  }
};

// @desc    Create a new auction
// @route   POST /api/auctions
// @access  Private
export const createAuction = async (req, res) => {
  try {
    let { title, description, startPrice, bidIncrement, startTime, endTime, category, condition, itemSpecifics, reservePrice, buyNowPrice, shippingDetails, returnPolicy } = req.body;

    // Sanitize empty strings to undefined for Number fields to prevent Mongoose CastError
    reservePrice = (!reservePrice || reservePrice === "null") ? undefined : Number(reservePrice);
    buyNowPrice = (!buyNowPrice || buyNowPrice === "null") ? undefined : Number(buyNowPrice);

    itemSpecifics = typeof itemSpecifics === 'string' ? JSON.parse(itemSpecifics) : itemSpecifics;
    
    shippingDetails = typeof shippingDetails === 'string' ? JSON.parse(shippingDetails) : shippingDetails;
    if (shippingDetails) {
      if (shippingDetails.cost === "") shippingDetails.cost = undefined;
      if (shippingDetails.weight === "") shippingDetails.weight = undefined;
      if (shippingDetails.handlingDays === "") shippingDetails.handlingDays = undefined;
    }

    returnPolicy = typeof returnPolicy === 'string' ? JSON.parse(returnPolicy) : returnPolicy;
    if (returnPolicy) {
      if (returnPolicy.returnWindowDays === "") returnPolicy.returnWindowDays = undefined;
    }

    if (!title || !startPrice || !startTime || !endTime || !category || !condition) {
      return res
        .status(400)
        .json({ message: "title, startPrice, startTime, endTime, category, condition are required" });
    }

    if (new Date(endTime) <= new Date(startTime)) {
      return res
        .status(400)
        .json({ message: "End time must be after start time" });
    }

    if (reservePrice && Number(reservePrice) < Number(startPrice)) {
      return res
        .status(400)
        .json({ message: "Reserve price cannot be less than the starting price" });
    }

    // Images uploaded by multer-storage-cloudinary are in req.files
    const images = req.files
      ? req.files.map((file) => ({
          url: file.path,          // Cloudinary URL
          public_id: file.filename, // Cloudinary public_id
        }))
      : [];

    const auction = await Auction.create({
      title,
      description,
      images,
      seller: req.user._id,
      startPrice: Number(startPrice),
      currentPrice: Number(startPrice), // Starts at startPrice
      bidIncrement: bidIncrement ? Number(bidIncrement) : 100,
      startTime: new Date(startTime),
      endTime: new Date(endTime),
      status:
        new Date(startTime) <= new Date() && new Date(endTime) > new Date()
          ? "live"
          : new Date(startTime) > new Date()
          ? "upcoming"
          : "ended",
      category,
      condition,
      itemSpecifics,
      reservePrice,
      buyNowPrice,
      shippingDetails,
      returnPolicy,
    });

    res.status(201).json({ auction });
  } catch (error) {
    console.error("Create auction error:", error);
    res.status(500).json({ message: "Server error creating auction" });
  }
};

// @desc    Get all auctions (with optional status filter)
// @route   GET /api/auctions?status=live|upcoming|ended
// @access  Public
export const getAllAuctions = async (req, res) => {
  try {
    await lazyUpdateAuctionStatuses();

    const filter = {};
    if (req.query.status) {
      filter.status = req.query.status;
    }

    const auctions = await Auction.find(filter)
      .populate("seller", "name email")
      .populate("highestBidder", "name")
      .sort({ createdAt: -1 });

    res.status(200).json({ auctions, serverTime: new Date() });
  } catch (error) {
    console.error("Get auctions error:", error);
    res.status(500).json({ message: "Server error fetching auctions" });
  }
};

// @desc    Get a single auction by ID
// @route   GET /api/auctions/:id
// @access  Public
export const getAuctionById = async (req, res) => {
  try {
    await lazyUpdateAuctionStatuses();

    const auction = await Auction.findById(req.params.id)
      .populate("seller", "name email")
      .populate("highestBidder", "name")
      .populate("winnerId", "name email");

    if (!auction) {
      return res.status(404).json({ message: "Auction not found" });
    }

    let auctionObj = auction.toObject();
    if (!req.user || req.user._id.toString() !== auctionObj.seller._id.toString()) {
      delete auctionObj.reservePrice;
    }

    // Fetch recent bid history for this auction (latest 50)
    const bids = await Bid.find({ auction: req.params.id })
      .populate("bidder", "name")
      .sort({ createdAt: -1 })
      .limit(50);

    res.status(200).json({ auction: auctionObj, bids, serverTime: new Date() });
  } catch (error) {
    console.error("Get auction error:", error);
    res.status(500).json({ message: "Server error fetching auction" });
  }
};

// @desc    Get auctions created by me + auctions I've bid on
// @route   GET /api/auctions/my
// @access  Private
export const getMyAuctions = async (req, res) => {
  try {
    await lazyUpdateAuctionStatuses();

    const userId = req.user._id;

    // Auctions I created
    const myListings = await Auction.find({ seller: userId })
      .populate("highestBidder", "name")
      .sort({ createdAt: -1 });

    // Auctions I've placed bids on (deduplicated)
    const myBids = await Bid.find({ bidder: userId })
      .distinct("auction");

    const biddedAuctions = await Auction.find({ _id: { $in: myBids } })
      .populate("seller", "name")
      .populate("winnerId", "name")
      .sort({ createdAt: -1 });

    res.status(200).json({ myListings, biddedAuctions, serverTime: new Date() });
  } catch (error) {
    console.error("Get my auctions error:", error);
    res.status(500).json({ message: "Server error fetching your auctions" });
  }
};

// @desc    End an auction early (Seller only)
// @route   PUT /api/auctions/:id/end
// @access  Private
export const endAuctionEarly = async (req, res) => {
  try {
    const auction = await Auction.findById(req.params.id);
    if (!auction) {
      return res.status(404).json({ message: "Auction not found" });
    }

    if (auction.seller.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Only the seller can end this auction early" });
    }

    if (auction.status !== "live") {
      return res.status(400).json({ message: "Only live auctions can be ended early" });
    }

    auction.status = "ended";
    auction.endTime = new Date(); // Update end time to now
    
    // Set winner if there's a highest bidder
    if (auction.highestBidder) {
      auction.winnerId = auction.highestBidder;
    }

    await auction.save();

    // Broadcast to socket room
    const io = req.app.get("io");
    if (io) {
      io.to(`auction:${auction._id}`).emit("auction_ended", {
        winner: auction.winnerId,
        finalPrice: auction.currentPrice
      });
    }

    res.status(200).json({ message: "Auction ended early successfully", auction });
  } catch (error) {
    console.error("End auction early error:", error);
    res.status(500).json({ message: "Server error ending auction early" });
  }
};

// @desc    Delete an upcoming auction (Seller only)
// @route   DELETE /api/auctions/:id
// @access  Private
export const deleteAuction = async (req, res) => {
  try {
    const auction = await Auction.findById(req.params.id);
    if (!auction) {
      return res.status(404).json({ message: "Auction not found" });
    }

    if (auction.seller.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Only the seller can delete this auction" });
    }

    if (auction.status !== "upcoming") {
      return res.status(400).json({ message: "Only upcoming auctions can be deleted" });
    }

    await Auction.findByIdAndDelete(req.params.id);
    // Also clean up any bids just in case (though there shouldn't be any for upcoming)
    await Bid.deleteMany({ auction: req.params.id });

    res.status(200).json({ message: "Auction deleted successfully" });
  } catch (error) {
    console.error("Delete auction error:", error);
    res.status(500).json({ message: "Server error deleting auction" });
  }
};
