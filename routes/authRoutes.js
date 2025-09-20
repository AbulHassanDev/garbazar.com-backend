const express = require("express");
const router = express.Router();
const { protect, authMiddleware } = require("../middleware/auth");
const { register, login, upgradeToPro, getMe, forgotPassword, resetPassword } = require("../controllers/authController");

// Authentication routes
router.post("/register", register);
router.post("/login", login);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password/:token", resetPassword);
router.post("/upgrade-to-pro", protect, authMiddleware("normal"), upgradeToPro);
router.get("/me", protect, getMe);

module.exports = router;





