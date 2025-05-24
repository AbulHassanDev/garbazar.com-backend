const express = require('express');
   const router = express.Router();
   const { getCategories, getCategoryById, addCategory, updateCategory, deleteCategory } = require('../controllers/categoryController');
   const { protect, authMiddleware } = require('../middleware/auth');
   const { uploadFields } = require('../utils/cloudinary');

   // Public routes
   router.get('/', getCategories);
   router.get('/:id', getCategoryById);

   // Admin routes (protected and role-restricted)
   router.post('/', protect, authMiddleware('admin'), uploadFields, addCategory);
   router.put('/:id', protect, authMiddleware('admin'), uploadFields, updateCategory);
   router.delete('/:id', protect, authMiddleware('admin'), deleteCategory);

   module.exports = router;



