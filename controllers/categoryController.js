const mongoose = require('mongoose');
const Category = require('../models/Category');
const Subcategory = require('../models/Subcategory');
const Product = require('../models/Product');
const { cloudinary } = require('../utils/cloudinary');

// Get all categories with pagination and search
const getCategories = async (req, res) => {
  try {
    const { page = 1, limit = 10, search = '' } = req.query;
    const query = search ? { name: { $regex: search, $options: 'i' } } : {};

    console.log('Fetching categories with query:', query, 'Page:', page, 'Limit:', limit);
    const categories = await Category.find(query)
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const total = await Category.countDocuments(query);
    console.log('Total categories:', total);

    const categoriesWithCounts = await Promise.all(
      categories.map(async (category) => {
        const subcategoryCount = await Subcategory.countDocuments({ category: category._id });
        const productCount = await Product.countDocuments({ category: category._id });
        return {
          id: category._id,
          _id: category._id,
          name: category.name,
          slug: category.slug,
          description: category.description,
          bannerColor: category.bannerColor,
          status: category.status,
          image: category.image,
          createdAt: category.createdAt,
          updatedAt: category.updatedAt,
          subcategoryCount,
          productCount,
        };
      })
    );

    console.log('Categories fetched:', categoriesWithCounts.length);
    res.status(200).json(categoriesWithCounts);
  } catch (error) {
    console.error('Error fetching categories:', error.message);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Get a single category by ID or slug
const getCategoryById = async (req, res) => {
  try {
    const { id } = req.params;
    let category;

    if (mongoose.Types.ObjectId.isValid(id)) {
      category = await Category.findById(id);
    } else {
      category = await Category.findOne({ slug: id });
    }

    if (!category) {
      return res.status(404).json({ message: 'Category not found' });
    }

    const subcategoryCount = await Subcategory.countDocuments({ category: category._id });
    const productCount = await Product.countDocuments({ category: category._id });
    res.status(200).json({
      id: category._id,
      _id: category._id,
      name: category.name,
      slug: category.slug,
      description: category.description,
      bannerColor: category.bannerColor,
      status: category.status,
      image: category.image,
      createdAt: category.createdAt,
      updatedAt: category.updatedAt,
      subcategoryCount,
      productCount,
    });
  } catch (error) {
    console.error('Error fetching category:', error.message);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Add a new category (updated)
const addCategory = async (req, res) => {
  try {
    console.log('Adding category - Request body:', req.body);
    console.log('Adding category - Request files:', req.files);

    const { name, description, slug, bannerColor, status } = req.body;

    if (!name || !slug) {
      return res.status(400).json({ message: 'Name and slug are required' });
    }

    const existingCategory = await Category.findOne({ slug });
    if (existingCategory) {
      return res.status(400).json({ message: 'Category with this slug already exists' });
    }

    let imageUrl = '';
    if (req.files && req.files.image && req.files.image[0]) {
      imageUrl = req.files.image[0].path;
      console.log('Image uploaded:', imageUrl);
    }

    const category = new Category({
      name,
      description,
      slug,
      bannerColor: bannerColor || '#22c55e',
      status: status || 'active',
      image: imageUrl,
    });

    await category.save();
    res.status(201).json({
      id: category._id,
      _id: category._id,
      name: category.name,
      slug: category.slug,
      description: category.description,
      bannerColor: category.bannerColor,
      status: category.status,
      image: category.image,
      createdAt: category.createdAt,
      updatedAt: category.updatedAt,
      subcategoryCount: 0,
      productCount: 0,
    });
  } catch (error) {
    console.error('Error adding category:', error.message);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Update a category (updated)
const updateCategory = async (reqAst, res) => {
  try {
    const { name, description, slug, bannerColor, status, removeImage } = req.body;

    const category = await Category.findById(req.params.id);
    if (!category) {
      return res.status(404).json({ message: 'Category not found' });
    }

    if (slug && slug !== category.slug) {
      const existingCategory = await Category.findOne({ slug });
      if (existingCategory) {
        return res.status(400).json({ message: 'Category with this slug already exists' });
      }
    }

    if (req.files && req.files.image && req.files.image[0]) {
      if (category.image) {
        const publicId = category.image.split('/').pop().split('.')[0];
        await cloudinary.uploader.destroy(`ecommerce/${publicId}`);
      }
      category.image = req.files.image[0].path;
    } else if (removeImage === 'true' && category.image) {
      const publicId = category.image.split('/').pop().split('.')[0];
      await cloudinary.uploader.destroy(`ecommerce/${publicId}`);
      category.image = '';
    }

    category.name = name || category.name;
    category.description = description || category.description;
    category.slug = slug || category.slug;
    category.bannerColor = bannerColor || category.bannerColor;
    category.status = status || category.status;

    await category.save();

    const subcategoryCount = await Subcategory.countDocuments({ category: category._id });
    const productCount = await Product.countDocuments({ category: category._id });

    res.status(200).json({
      id: category._id,
      _id: category._id,
      name: category.name,
      slug: category.slug,
      description: category.description,
      bannerColor: category.bannerColor,
      status: category.status,
      image: category.image,
      createdAt: category.createdAt,
      updatedAt: category.updatedAt,
      subcategoryCount,
      productCount,
    });
  } catch (error) {
    console.error('Error updating category:', error.message);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Delete a category
const deleteCategory = async (req, res) => {
  try {
    const category = await Category.findById(req.params.id);
    if (!category) {
      return res.status(404).json({ message: 'Category not found' });
    }

    const subcategoryCount = await Subcategory.countDocuments({ category: category._id });
    const productCount = await Product.countDocuments({ category: category._id });
    if (subcategoryCount > 0 || productCount > 0) {
      return res.status(400).json({ message: 'Cannot delete category with associated subcategories or products' });
    }

    if (category.image) {
      const publicId = category.image.split('/').pop().split('.')[0];
      await cloudinary.uploader.destroy(`ecommerce/${publicId}`);
    }

    await Category.deleteOne({ _id: category._id });
    res.status(200).json({ message: 'Category deleted successfully' });
  } catch (error) {
    console.error('Error deleting category:', error.message);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

module.exports = {
  getCategories,
  getCategoryById,
  addCategory,
  updateCategory,
  deleteCategory,
};