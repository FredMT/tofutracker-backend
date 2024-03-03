const express = require("express");
const { getMovie } = require("../controllers/movieController");

const router = express.Router();

router.get("/getmovie/:id", getMovie);

module.exports = router;
