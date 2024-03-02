const express = require("express");
const cors = require("cors");
const axios = require("axios");
require("dotenv").config();
const movieRoutes = require("./routes/movieRoutes");
const trendingRoutes = require("./routes/trendingRoutes");
const tvRoutes = require("./routes/tvRoutes");

const app = express();
app.use(cors());

const port = process.env.PORT || 8080;

app.use("/api", movieRoutes);
app.use("/api", trendingRoutes);
app.use("/api", tvRoutes);

app.get("/api/search/:query", async (req, res) => {
  try {
    const searchResponse = await axios.get(
      `https://api.themoviedb.org/3/search/movie?api_key=${process.env.TMDB_API_KEY}&query=${req.params.query}`
    );
    res.send(searchResponse.data);
  } catch (error) {
    console.log(`Error: ${error}`);
    res
      .status(500)
      .send("An error occurred while trying to fetch the search results");
  }
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
