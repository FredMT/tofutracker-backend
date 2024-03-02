const express = require("express");
const cors = require("cors");
const axios = require("axios");
require("dotenv").config();
const movieRoutes = require("./routes/movieRoutes");
const trendingRoutes = require("./routes/trendingRoutes");
const tvRoutes = require("./routes/tvRoutes");
const searchRoutes = require("./routes/searchRoutes");

const app = express();
app.use(cors());

const port = process.env.PORT || 8080;

app.use("/api", movieRoutes);
app.use("/api", trendingRoutes);
app.use("/api", tvRoutes);
app.use("/api/search", searchRoutes);

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
