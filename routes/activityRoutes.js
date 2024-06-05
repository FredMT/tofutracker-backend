const express = require("express");

const {
  fetchPosters,
  getActivityItemData,
} = require("../controllers/activityController");
const router = express.Router();

router.get("/getposters/:id", async (req, res) => {
  const { id } = req.params;
  const posters = await fetchPosters(id);
  res.send(posters);
});

router.get("/getactivityitemdata/:id", async (req, res) => {
  const { id } = req.params;
  const activityItemData = await getActivityItemData(id);
  res.send(activityItemData);
});

module.exports = router;
