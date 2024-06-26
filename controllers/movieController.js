import { fetchMovieDataFromAPI } from "../services/tmdbServices.js";
import supabase from "../supabaseClient.js";
import redis from "../ioredisClient.js";

const fetchMovieData = async (movieId) => {
  const movieResponse = await fetchMovieDataFromAPI(movieId);
  return movieResponse;
};

export const getMovie = async (req, res) => {
  try {
    const movieId = req.params.id;
    const cacheKey = `movie:${movieId}`;

    // Try to fetch from cache first
    const cachedMovie = await redis.get(cacheKey);
    if (cachedMovie) {
      return res.json(JSON.parse(cachedMovie));
    }

    const { data, error } = await supabase
      .from("anidb_tvdb_tmdb_mapping")
      .select("anidb_id")
      .eq("tmdb_id", movieId)
      .single();

    if (error && error.code !== "PGRST116") {
      console.error("Error querying anidb_tvdb_tmdb_mapping:", error.message);
      return res
        .status(500)
        .send("An error occurred while trying to fetch the movie data");
    }

    if (data) {
      return res.status(404).send({ message: "This is an anime.", data });
    }

    const movieData = await fetchMovieData(movieId);

    if (!movieData) {
      return res.status(404).send("Movie not found.");
    }

    await redis.set(cacheKey, JSON.stringify(movieData), "EX", 900);
    res.json(movieData);
  } catch (error) {
    res
      .status(500)
      .send("An error occurred while trying to fetch the movie data");
  }
};
