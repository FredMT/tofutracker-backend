import express from "express";
import cors from "cors";
import "dotenv/config";
import trendingRoutes from "./routes/trendingRoutes.js";
import movieRoutes from "./routes/movieRoutes.js";
import tvRoutes from "./routes/tvRoutes.js";
import animeRoutes from "./routes/animeRoutes.js";
import searchRoutes from "./routes/searchRoutes.js";
import commentsRoutes from "./routes/commentsRoutes.js";
import activityRoutes from "./routes/activityRoutes.js";
import otherRoutes from "./routes/otherRoutes.js";
import { createClient } from "redis";

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
app.use("/api", otherRoutes);

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
