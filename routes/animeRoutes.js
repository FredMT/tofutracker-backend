const express = require("express");

const {
  fetchAnime,
  fetchAnimeChain,
  fetchAnimeImagesFromTMDB,
  fetchRelations,
} = require("../controllers/animeController");

const router = express.Router();

router.get("/getanime/:id", fetchAnime);
router.get("/getanimechain/:id", fetchAnimeChain);
router.get("/getanimeimages/:type/:id", fetchAnimeImagesFromTMDB);
router.get("/getanimerelations/:id", fetchRelations);

module.exports = router;
