import express from "express";
import {
  getBackdropImage,
  getTopTenBackdrops,
} from "../services/tmdbServices.js";
const router = express.Router();

router.get("/getbackdropimage/:type/:id", async (req, res) => {
  const { type, id } = req.params;
  const backdrop = await getBackdropImage(type, id);
  res.json(backdrop);
});

router.get("/gettoptenbackdrops/:type/:id", async (req, res) => {
  const { type, id } = req.params;
  const backdrops = await getTopTenBackdrops(type, id);
  res.json(backdrops);
});

export default router;
