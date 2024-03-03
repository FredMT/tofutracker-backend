const express = require("express");

const {
  fetchAnime,
  fetchAnimeChain,
} = require("../controllers/animeController");

const router = express.Router();

router.get("/getanime/:id", fetchAnime);
router.get("/getanimechain/:id", fetchAnimeChain);

module.exports = router;
