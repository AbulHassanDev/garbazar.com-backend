const express = require("express");
const router = express.Router();
const forgotPassword = require("../controllers/forgotPasswordController");

router.post("/", forgotPassword);

module.exports = router;