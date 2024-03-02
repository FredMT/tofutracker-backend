const express = require("express");
const { getTV, getTVSeason } = require("../controllers/tvController");

const router = express.Router();

router.get("/gettv/:id", getTV);
router.get("/gettvseason/:id/:season_number", getTVSeason);

module.exports = router;
