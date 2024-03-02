const { searchMovies } = require("../services/tmdbServices");

async function search(req, res) {
  try {
    const { query } = req.params;
    const searchResults = await searchMovies(query);
    const results = searchResults.results;
    res.send(results);
  } catch (error) {
    console.log(`Error: ${error}`);
    res
      .status(500)
      .send("An error occurred while trying to fetch the search results");
  }
}

module.exports = { search };
