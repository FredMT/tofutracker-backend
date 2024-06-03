const express = require("express");

const { fetchPoster, fetchPosterTest } = require("../services/tmdbServices");

const router = express.Router();

router.get("/getposter/:id", async (req, res) => {
  const { id } = req.params;
  const poster = await fetchPoster(id);
  res.send(poster);
});

module.exports = router;
