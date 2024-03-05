const express = require("express");

const {
  fetchAnime,
  fetchAnimeChain,
  fetchTmdbId,
  fetchAnimeImagesFromTMDB,
} = require("../controllers/animeController");

const router = express.Router();

router.get("/getanime/:id", fetchAnime);
router.get("/getanimechain/:id", fetchAnimeChain);
router.get("/getanimeimages/:type/:id", fetchAnimeImagesFromTMDB);

module.exports = router;
