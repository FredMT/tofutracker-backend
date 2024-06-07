const express = require("express");

const {
  getCommentsLoggedInUser,
  getComments,
} = require("../models/commentsModel");

const router = express.Router();

router.get("/comments/:id/", async (req, res) => {
  const { id } = req.params;
  const comments = await getComments(id);
  res.send(comments);
});

router.get("/comments/:id/:userId", async (req, res) => {
  const { id, userId } = req.params;
  const comments = await getCommentsLoggedInUser(id, userId);
  res.send(comments);
});

module.exports = router;
