// routes/cartRoutes.js
const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/auth");
const {
  addToCart,
  getCart,
  updateCartItem,
  removeCartItem,
  clearCart,
} = require("../controllers/CartController");

// Add item to cart (Create)
router.post("/add", protect, addToCart);

// Get cart items (Read)
router.get("/", protect, getCart);

// Update item quantity (Update)
router.put("/update", protect, updateCartItem);

// Remove item from cart (Delete)
router.delete("/remove/:productId", protect, removeCartItem);

// Clear entire cart (Delete All)
router.delete("/clear", protect, clearCart);

module.exports = router;