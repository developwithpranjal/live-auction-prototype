import mongoose from "mongoose";

const auctionSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Auction title is required"],
      trim: true,
      maxlength: [100, "Title cannot exceed 100 characters"],
    },
    description: {
      type: String,
      required: [true, "Description is required"],
      maxlength: [2000, "Description cannot exceed 2000 characters"],
    },
    images: [
      {
        url: { type: String, required: true },
        public_id: { type: String, required: true }, // Cloudinary public_id for deletion
      },
    ],
    seller: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    startPrice: {
      type: Number,
      required: [true, "Starting price is required"],
      min: [0, "Price must be a positive number"],
    },
    currentPrice: {
      type: Number,
      // Set to startPrice on creation (done in controller)
    },
    bidIncrement: {
      type: Number,
      required: [true, "Bid increment is required"],
      min: [1, "Bid increment must be at least 1"],
      default: 100,
    },
    startTime: {
      type: Date,
      required: [true, "Start time is required"],
    },
    endTime: {
      type: Date,
      required: [true, "End time is required"],
    },
    status: {
      type: String,
      enum: ["upcoming", "live", "ended"],
      default: "upcoming",
    },
    highestBidder: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    winnerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    isPaid: {
      type: Boolean,
      default: false,
    },
    deliveryDetails: {
      address: String,
      city: String,
      pincode: String,
      phone: String,
    },
    deliveryStatus: {
      type: String,
      enum: ['processing', 'shipped', 'out_for_delivery', 'delivered'],
      default: 'processing',
    },
    category: {
      type: String,
      required: [true, "Category is required"],
      enum: ["Electronics", "Watches", "Art", "Collectibles", "Fashion", "Automotive", "Other"],
    },
    condition: {
      type: String,
      required: [true, "Condition is required"],
      enum: ["New", "Like New", "Good", "Fair", "For Parts"],
    },
    itemSpecifics: {
      type: Map,
      of: String,
      default: {},
    },
    reservePrice: {
      type: Number,
      validate: {
        validator: function (value) {
          if (value == null) return true;
          return value >= this.startPrice;
        },
        message: "Reserve price must be greater than or equal to the starting price",
      },
    },
    buyNowPrice: {
      type: Number,
    },
    shippingDetails: {
      cost: Number,
      weight: Number,
      handlingDays: Number,
      localPickupAvailable: {
        type: Boolean,
        default: false,
      },
    },
    returnPolicy: {
      returnsAccepted: {
        type: Boolean,
        default: false,
      },
      returnWindowDays: Number,
    },
  },
  { timestamps: true }
);

// Index for efficient status-based queries
auctionSchema.index({ status: 1, endTime: 1 });
auctionSchema.index({ seller: 1 });

const Auction = mongoose.model("Auction", auctionSchema);
export default Auction;
