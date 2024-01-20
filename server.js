const express = require("express");
const cors = require("cors");
const axios = require("axios");
require("dotenv").config();

const app = express();
app.use(cors());
const port = 8080;

app.get("/api/trending", async (req, res) => {
  try {
    const trendingResponse = await axios.get(
      `https://api.themoviedb.org/3/trending/movie/week?api_key=${process.env.TMDB_API_KEY}`
    );

    const moviesWithLogos = await Promise.all(
      trendingResponse.data.results.map(async (movie) => {
        try {
          const imagesResponse = await axios.get(
            `https://api.themoviedb.org/3/movie/${movie.id}/images?api_key=${process.env.TMDB_API_KEY}&include_image_language=en,null`
          );
          const logos = imagesResponse.data.logos;
          if (logos && logos.length > 0) {
            movie.logo_path = logos[0].file_path; // Append the first logo's file path
          }
          return movie;
        } catch (imageError) {
          console.error(
            `Error fetching images for movie ID ${movie.id}: ${imageError}`
          );
          return movie; // Return the movie without a logo if the images request fails
        }
      })
    );

    // Replace the original results with the updated moviesWithLogos
    trendingResponse.data.results = moviesWithLogos;
    res.send(trendingResponse.data);
  } catch (error) {
    console.error(`Error: ${error}`);
    res
      .status(500)
      .send("An error occurred while trying to fetch trending movies");
  }
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
