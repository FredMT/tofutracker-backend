const { getAnime, getAnimeChain } = require("../models/animeModel");

async function fetchAnime(req, res) {
  const id = req.params.id;
  const animeData = await getAnime(id);

  if (!animeData) {
    return res.status(404).send("Anime not found.");
  }

  res.json(animeData);
}

async function fetchAnimeChain(req, res) {
  const id = req.params.id;
  const animeChain = await getAnimeChain(id);

  if (!animeChain) {
    return res.status(404).send("Anime chain not found.");
  }

  res.json(animeChain);
}

module.exports = { fetchAnime, fetchAnimeChain };
