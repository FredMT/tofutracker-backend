const {
  fetchMovieLogos,
  fetchTrendingMovies,
} = require("../services/tmdbServices");

async function enrichMoviesWithLogos(movies) {
  const enrichedMovies = await Promise.all(
    movies.map(async (movie) => {
      try {
        const logos = await fetchMovieLogos(movie.id);
        if (logos && logos.length > 0) {
          movie.logo_path = logos[0].file_path;
        }
        return movie;
      } catch (error) {
        console.log(`Error fetching images for movie ID ${movie.id}: ${error}`);
        return movie; // Return movie without logo in case of error
      }
    })
  );
  return enrichedMovies;
}

async function getTrendingMovies(_, res) {
  try {
    let movies = await fetchTrendingMovies();
    movies = await enrichMoviesWithLogos(movies);

    res.send({ results: movies });
  } catch (error) {
    console.log(`Error: ${error}`);
    res
      .status(500)
      .send("An error occurred while trying to fetch trending movies");
  }
}

module.exports = { getTrendingMovies };
