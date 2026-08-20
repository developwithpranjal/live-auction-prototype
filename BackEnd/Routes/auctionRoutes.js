import express from "express";
import {
  createAuction,
  getAllAuctions,
  getAuctionById,
  getMyAuctions,
  endAuctionEarly,
  deleteAuction,
} from "../Controllers/auctionController.js";
import { protect, softProtect } from "../Middleware/authMiddleware.js";
import { uploadImages } from "../Middleware/uploadMiddleware.js";

const router = express.Router();

// IMPORTANT: /my must come before /:id or Express will treat "my" as an ID
router.get("/my", protect, getMyAuctions);

router.get("/", getAllAuctions);
router.get("/:id", softProtect, getAuctionById);
router.put("/:id/end", protect, endAuctionEarly);
router.delete("/:id", protect, deleteAuction);
router.post("/", protect, uploadImages, createAuction);

export default router;
