import express from "express";
import { getCart, addToCart, removeFromCart } from "../Controllers/cartController.js";
import { protect } from "../Middleware/authMiddleware.js";

const router = express.Router();

router.get("/", protect, getCart);
router.post("/:auctionId", protect, addToCart);
router.delete("/:auctionId", protect, removeFromCart);

export default router;
