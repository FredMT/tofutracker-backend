const express = require("express");

const { getComments } = require("../models/commentsModel");

const router = express.Router();

router.get("/comments/:id/:userId", async (req, res) => {
  const { id, userId } = req.params;
  const comments = await getComments(id, userId);
  res.send(comments);
});

module.exports = router;
