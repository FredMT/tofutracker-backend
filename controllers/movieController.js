const { fetchExistingMovie, insertMovieData } = require("../models/movieModel");
const { fetchMovieDataFromAPI } = require("../services/tmdbServices");
const supabase = require("../supabaseClient");

const fetchMovieData = async (movieId) => {
  const existingMovie = await fetchExistingMovie(movieId);
  if (existingMovie) {
    return existingMovie.movies_data;
  }

  const movieResponse = await fetchMovieDataFromAPI(movieId);

  await insertMovieData(movieResponse, movieId);

  return movieResponse;
};

exports.getMovie = async (req, res) => {
  try {
    const movieId = req.params.id;

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
      return res.status(404).send("This is an anime.");
    }

    const movieData = await fetchMovieData(movieId);

    if (!movieData) {
      return res.status(404).send("Movie not found.");
    }

    res.json(movieData);
  } catch (error) {
    res
      .status(500)
      .send("An error occurred while trying to fetch the movie data");
  }
};
