import { searchMovies, searchTV } from "../services/tmdbServices.js";
import { searchAnime } from "../controllers/animeController.js";

async function search(req, res) {
  try {
    const { query } = req.params;
    const movieSearchResults = await searchMovies(query);
    const tvSearchResults = await searchTV(query);
    const animeSearchResults = await searchAnime(query);
    const data = {
      movies: movieSearchResults.results,
      tv: tvSearchResults.results,
      anime: animeSearchResults,
    };
    res.status(200).json({ ok: true, data });
  } catch (error) {
    console.log(`Error: ${error}`);
    res
      .status(500)
      .send("An error occurred while trying to fetch the search results");
  }
}

export { search };
