import express from "express";
import { getTV, getTVSeason } from "../controllers/tvController.js";

const router = express.Router();

router.get("/gettv/:id", getTV);
router.get("/gettvseason/:id/:season_number", getTVSeason);

export default router;
