const express = require("express");

const { fetchPoster } = require("../services/tmdbServices");

const router = express.Router();

router.get("/getposter/:type/:id", async (req, res) => {
  const { type, id } = req.params;
  const poster = await fetchPoster(type, id);
  res.send(poster);
});

module.exports = router;
