const movieModel = require("../models/movieModel");

exports.getMovie = async (req, res) => {
  try {
    const movieId = req.params.id;

    const movieData = await movieModel.fetchMovieData(movieId);

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
