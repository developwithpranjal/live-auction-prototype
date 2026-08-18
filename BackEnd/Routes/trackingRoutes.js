import express from "express";
import { advanceTrackingStatus } from "../Controllers/trackingController.js";
import { protect } from "../Middleware/authMiddleware.js";

const router = express.Router();

router.post("/:auctionId/advance", protect, advanceTrackingStatus);

export default router;
