const express = require("express");
const cors = require("cors");
require("dotenv").config();
const trendingRoutes = require("./routes/trendingRoutes");
const movieRoutes = require("./routes/movieRoutes");
const tvRoutes = require("./routes/tvRoutes");
const animeRoutes = require("./routes/animeRoutes");
const searchRoutes = require("./routes/searchRoutes");
const commentsRoutes = require("./routes/commentsRoutes");
const activityRoutes = require("./routes/activityRoutes");
const { getBackdropImage } = require("./services/tmdbServices");

const app = express();
app.use(cors());

const port = process.env.PORT || 8080;

app.use("/api", trendingRoutes);
app.use("/api", movieRoutes);
app.use("/api", tvRoutes);
app.use("/api", animeRoutes);
app.use("/api", searchRoutes);
app.use("/api", activityRoutes);
app.use("/api", commentsRoutes);

app.get("/api/getbackdropimage/:type/:id", async (req, res) => {
  const { type, id } = req.params;
  const backdrop = await getBackdropImage(type, id);
  res.json(backdrop);
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
