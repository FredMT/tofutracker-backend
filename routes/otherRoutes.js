const express = require("express");

const { fetchPoster } = require("../services/tmdbServices");
const { getComments } = require("../models/commentsModel");

const router = express.Router();

router.get("/getposter/:id", async (req, res) => {
  const { id } = req.params;
  const poster = await fetchPoster(id);
  res.send(poster);
});

router.get("/comments/:id", async (req, res) => {
  const { id } = req.params;
  const comments = await getComments(id);
  res.send(comments);
});

module.exports = router;
