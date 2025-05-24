const express = require("express");
const router = express.Router();
const { protect, authMiddleware } = require("../middleware/auth");
const { getUsers, getUserCount } = require("../controllers/userController");

console.log('userController:', { getUsers, getUserCount });

router.get("/", getUsers); // Fetch users with pagination and search
router.get("/count", protect, authMiddleware("admin"), getUserCount); // Fetch user count (non-admins)

module.exports = router;