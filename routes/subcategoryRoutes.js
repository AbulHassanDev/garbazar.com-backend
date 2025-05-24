const express = require('express');
const router = express.Router();
const {
  getSubcategories,
  getSubcategoryById,
  getSubcategoryBySlug, // Add this
  getSubcategoriesByCategory,
  addSubcategory,
  updateSubcategory,
  deleteSubcategory,
} = require('../controllers/subcategoryController');
const { protect, authMiddleware } = require('../middleware/auth');
const { uploadFields } = require('../utils/cloudinary');

// Public routes
router.get('/', getSubcategories);
router.get('/:id', getSubcategoryById);
router.get('/slug/:slug', getSubcategoryBySlug); // Add this route
router.get('/category/:categoryId', getSubcategoriesByCategory);

// Admin routes (protected and role-restricted)
router.post('/', protect, authMiddleware('admin'), uploadFields, addSubcategory);
router.put('/:id', protect, authMiddleware('admin'), uploadFields, updateSubcategory);
router.delete('/:id', protect, authMiddleware('admin'), deleteSubcategory);

module.exports = router;