import express from "express";
import { getBidHistory } from "../Controllers/bidController.js";

const router = express.Router();

router.get("/:auctionId", getBidHistory);

export default router;
