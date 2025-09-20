
const express = require("express");
const router = express.Router();
const {
  createCheckoutOrder,
  getOrders,
  getOrderById,
  getUserOrders,
  updateOrder,
  deleteOrder,
  getOrderCount,
  getTotalSales,
  updatePayment,
  validateOrder,
  getUserProfile,
  addOrder,
} = require("../controllers/orderController");
const { protect } = require("../middleware/auth");

router.post("/checkout", protect, validateOrder, createCheckoutOrder);
router.post("/update-payment", protect, updatePayment);

router.get("/", protect, getOrders);
router.get("/user", protect, getUserOrders);
router.get("/user/profile", protect, getUserProfile);
router.get("/count", protect, getOrderCount);
router.get("/total-sales", protect, getTotalSales);

router.get("/:id", protect, getOrderById);
router.put("/:id", protect, updateOrder);
router.delete("/:id", protect, deleteOrder);

module.exports = router;