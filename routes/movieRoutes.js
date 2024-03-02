const express = require("express");
const moviesController = require("../controllers/movieController");

const router = express.Router();

router.get("/getmovie/:id", moviesController.getMovie);

module.exports = router;
