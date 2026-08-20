import express from "express";
import { toggleWishlist, getWishlist } from "../Controllers/userController.js";
import { protect } from "../Middleware/authMiddleware.js";

const router = express.Router();

router.post("/wishlist", protect, toggleWishlist);
router.get("/wishlist", protect, getWishlist);

export default router;
