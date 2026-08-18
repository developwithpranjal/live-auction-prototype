import express from "express";
import { processCheckout } from "../Controllers/checkoutController.js";
import { protect } from "../Middleware/authMiddleware.js";

const router = express.Router();

router.post("/:auctionId", protect, processCheckout);

export default router;
