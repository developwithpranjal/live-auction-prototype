import mongoose from "mongoose";

const offerSchema = new mongoose.Schema(
  {
    auction: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Auction",
      required: true,
    },
    buyer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    amount: {
      type: Number,
      required: true,
    },
    status: {
      type: String,
      enum: ["pending", "accepted", "rejected", "expired"],
      default: "pending",
    },
  },
  { timestamps: true }
);

// Optimize queries for auction offers and their status
offerSchema.index({ auction: 1, status: 1 });

const Offer = mongoose.model("Offer", offerSchema);
export default Offer;
