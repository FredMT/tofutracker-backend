import express from "express";
import {
  getTrending,
  getTrendingByID,
  updateTrending,
} from "../controllers/trendingController.js";

const router = express.Router();

router.get("/trending", getTrending);
router.get("/trending/:id", getTrendingByID);
router.get("/update/trending", updateTrending);

export default router;
