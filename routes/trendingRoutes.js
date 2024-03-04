const express = require("express");
const {
  getTrending,
  updateTrending,
} = require("../controllers/trendingController");

const router = express.Router();

router.get("/trending", getTrending);
router.get("/trending/update", updateTrending);

module.exports = router;
