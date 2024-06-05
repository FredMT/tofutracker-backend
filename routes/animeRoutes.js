const express = require("express");

const {
  fetchAnime,
  fetchAnimeChain,
  fetchAnimeImagesFromTMDB,
  fetchRelations,
  fetchRelationsInfo,
  fetchAnimeEpisodes,
  fetchSimilarAnime,
  checkAnimeInLibrary,
} = require("../controllers/animeController");

const router = express.Router();

router.get("/getanime/:id", fetchAnime);
router.get("/getanimechain/:id", fetchAnimeChain);
router.get("/getanimeimages/:type/:id", fetchAnimeImagesFromTMDB);
router.get("/getanimerelations/:id", fetchRelations);
router.get("/getanimerelationsinfo/:id", fetchRelationsInfo);
router.get("/getanimeepisodes/:id/:start_date/:end_date", fetchAnimeEpisodes);
router.get("/getsimilaranime/:type/:id", fetchSimilarAnime);
router.get("/checkanimeinlibrary/:id/:user_id", checkAnimeInLibrary);

module.exports = router;
