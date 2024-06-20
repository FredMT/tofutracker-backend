import { searchMovies, searchTV } from "../services/tmdbServices.js";
import { searchAnime } from "../controllers/animeController.js";
import redis from "../ioredisClient.js";

async function search(req, res) {
  try {
    const { query } = req.params;
    const cacheKey = `search:${query}`;
    const cachedSearchResults = await redis.get(cacheKey);
    if (cachedSearchResults) {
      return res.json(JSON.parse(cachedSearchResults));
    }
    console.log("searching movies");
    const movieSearchResults = await searchMovies(query);
    console.log("searching tv");
    const tvSearchResults = await searchTV(query);
    console.log("searching anime");
    const animeSearchResults = await searchAnime(query);

    const data = {
      movies: movieSearchResults.results,
      tv: tvSearchResults.results,
      anime: animeSearchResults,
    };
    console.log("retrieved data");
    await redis.set(cacheKey, JSON.stringify({ ok: true, data }), "EX", 900);
    res.status(200).json({ ok: true, data });
  } catch (error) {
    console.log(`Error: ${error}`);
    res
      .status(500)
      .send("An error occurred while trying to fetch the search results");
  }
}

export { search };
