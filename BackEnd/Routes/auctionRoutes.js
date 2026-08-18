import express from "express";
import {
  createAuction,
  getAllAuctions,
  getAuctionById,
  getMyAuctions,
  endAuctionEarly,
} from "../Controllers/auctionController.js";
import { protect } from "../Middleware/authMiddleware.js";
import { uploadImages } from "../Middleware/uploadMiddleware.js";

const router = express.Router();

// IMPORTANT: /my must come before /:id or Express will treat "my" as an ID
router.get("/my", protect, getMyAuctions);

router.get("/", getAllAuctions);
router.get("/:id", getAuctionById);
router.put("/:id/end", protect, endAuctionEarly);
router.post("/", protect, uploadImages, createAuction);

export default router;
