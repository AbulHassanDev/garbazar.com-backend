
const express = require("express");
const router = express.Router();
const { getOrders, getOrderById, getUserOrders, addOrder, updateOrder, deleteOrder, getOrderCount, getTotalSales, validateOrder } = require("../controllers/orderController");
const { protect, authMiddleware } = require("../middleware/auth");

// Admin routes
router.get("/count", protect, authMiddleware("admin"), getOrderCount); // Get total order count
router.get("/total-sales", protect, authMiddleware("admin"), getTotalSales); // Get total sales
router.post("/", protect, authMiddleware("admin"), validateOrder, addOrder); // Add a new order
router.put("/:id", protect, authMiddleware("admin"), validateOrder, updateOrder); // Update an order
router.delete("/:id", protect, authMiddleware("admin"), deleteOrder); // Delete an order

// Public routes (authenticated users)
router.get("/", protect, getOrders); // Fetch orders with pagination and search
router.get("/user", protect, getUserOrders); // Fetch orders for the logged-in user
router.get("/:id", protect, getOrderById); // Fetch a single order by ID

module.exports = router;