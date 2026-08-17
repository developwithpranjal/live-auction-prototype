import Auction from "../Models/Auction.js";
import Bid from "../Models/Bid.js";

// @desc    Create a new auction
// @route   POST /api/auctions
// @access  Private
export const createAuction = async (req, res) => {
  try {
    const { title, description, startPrice, bidIncrement, startTime, endTime } =
      req.body;

    if (!title || !startPrice || !startTime || !endTime) {
      return res
        .status(400)
        .json({ message: "title, startPrice, startTime, endTime are required" });
    }

    if (new Date(endTime) <= new Date(startTime)) {
      return res
        .status(400)
        .json({ message: "End time must be after start time" });
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
    const filter = {};
    if (req.query.status) {
      filter.status = req.query.status;
    }

    const auctions = await Auction.find(filter)
      .populate("seller", "name email")
      .populate("highestBidder", "name")
      .sort({ createdAt: -1 });

    res.status(200).json({ auctions });
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
    const auction = await Auction.findById(req.params.id)
      .populate("seller", "name email")
      .populate("highestBidder", "name")
      .populate("winnerId", "name email");

    if (!auction) {
      return res.status(404).json({ message: "Auction not found" });
    }

    // Fetch recent bid history for this auction (latest 50)
    const bids = await Bid.find({ auction: req.params.id })
      .populate("bidder", "name")
      .sort({ createdAt: -1 })
      .limit(50);

    res.status(200).json({ auction, bids });
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

    res.status(200).json({ myListings, biddedAuctions });
  } catch (error) {
    console.error("Get my auctions error:", error);
    res.status(500).json({ message: "Server error fetching your auctions" });
  }
};
