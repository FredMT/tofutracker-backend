import express from "express";
import {
  getTrending,
  updateTrending,
} from "../controllers/trendingController.js";

const router = express.Router();

router.get("/trending", getTrending);
router.get("/trending/update", updateTrending);

export default router;
