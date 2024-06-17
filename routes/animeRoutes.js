import express from "express";

import {
  fetchAnime,
  fetchAnimeChain,
  fetchAnimeImagesFromTMDB,
  fetchRelations,
  fetchRelationsInfo,
  fetchAnimeEpisodes,
  fetchSimilarAnime,
  checkAnimeInLibrary,
} from "../controllers/animeController.js";

const router = express.Router();

router.get("/getanime/:id", fetchAnime);
router.get("/getanimechain/:id", fetchAnimeChain);
router.get("/getanimeimages/:type/:id", fetchAnimeImagesFromTMDB);
router.get("/getanimerelations/:id", fetchRelations);
router.get("/getanimerelationsinfo/:id", fetchRelationsInfo);
router.get("/getanimeepisodes/:id/:start_date/:end_date", fetchAnimeEpisodes);
router.get("/getsimilaranime/:type/:id", fetchSimilarAnime);
router.get("/checkanimeinlibrary/:id/:user_id", checkAnimeInLibrary);

export default router;
