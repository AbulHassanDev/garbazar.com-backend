const express = require("express");
const router = express.Router();
const {
  getProducts,
  getProductById,
  addProduct,
  updateProduct,
  deleteProduct,
  getFeaturedProducts,
  getRelatedProducts,
  getProductCount, // Add this
} = require("../controllers/productController");
const { protect, authMiddleware } = require("../middleware/auth");
const { uploadArray } = require("../utils/cloudinary");

// Public Routes: Accessible to all users
router.get("/", getProducts); // Fetch all products
router.get("/count", protect, authMiddleware("admin"), getProductCount); // Fetch product count
router.get("/featured", getFeaturedProducts); // Fetch featured products
router.get("/seasonal", (req, res) => {
  res.status(501).json({ message: "Seasonal products endpoint not implemented yet" });
}); // Fetch seasonal products
router.get("/:id", getProductById); // Fetch a single product by ID
router.get("/:productId/related", getRelatedProducts); // Fetch related products

// Admin Routes: Require authentication and admin role
router.post("/", protect, authMiddleware("admin"), uploadArray, addProduct);
router.put("/:id", protect, authMiddleware("admin"), uploadArray, updateProduct);
router.delete("/:id", protect, authMiddleware("admin"), deleteProduct);

module.exports = router;
