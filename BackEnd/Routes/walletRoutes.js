import express from "express";
import { getWalletBalance, addFunds } from "../Controllers/walletController.js";
import { protect } from "../Middleware/authMiddleware.js";

const router = express.Router();

router.get("/balance", protect, getWalletBalance);
router.post("/add", protect, addFunds);

export default router;
