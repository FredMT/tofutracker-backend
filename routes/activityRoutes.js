const express = require("express");

const {
  fetchPosters,
  fetchPostersLoggedInUser,
  getActivityItemData,
  getNumOfLikes,
} = require("../controllers/activityController");
const router = express.Router();

router.get("/getposters/:id", async (req, res) => {
  const { id } = req.params;
  const posters = await fetchPosters(id);
  res.send(posters);
});

router.get("/getposters/:id/:userId", async (req, res) => {
  const { id, userId } = req.params;
  const posters = await fetchPostersLoggedInUser(id, userId);
  res.send(posters);
});

router.get("/getactivityitemdata/:id", async (req, res) => {
  const { id } = req.params;
  const activityItemData = await getActivityItemData(id);
  res.send(activityItemData);
});

router.get("/getnumoflikes/:id", async (req, res) => {
  const { id } = req.params;
  const numOfLikes = await getNumOfLikes(id);
  res.send(numOfLikes);
});

module.exports = router;
