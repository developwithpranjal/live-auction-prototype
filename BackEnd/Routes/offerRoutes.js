import express from "express";
import { createOffer, getOffersForAuction, respondToOffer } from "../Controllers/offerController.js";
import { protect } from "../Middleware/authMiddleware.js";

const router = express.Router();

router.post("/", protect, createOffer);
router.get("/:auctionId", protect, getOffersForAuction);
router.put("/:offerId/respond", protect, respondToOffer);

export default router;
