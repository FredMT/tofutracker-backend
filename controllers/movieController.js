const { fetchExistingMovie, insertMovieData } = require("../models/movieModel");
const { fetchMovieDataFromAPI } = require("../services/tmdbServices");

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
