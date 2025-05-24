const express = require("express");
const router = express.Router();
const resetPassword = require("../controllers/resetPasswordController");

router.post("/:token", resetPassword);

module.exports = router;