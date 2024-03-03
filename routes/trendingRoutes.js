const express = require("express");
const { getTrending } = require("../controllers/trendingController");

const router = express.Router();

router.get("/trending", getTrending);

module.exports = router;
