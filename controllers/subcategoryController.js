const mongoose = require('mongoose');
const Subcategory = require('../models/Subcategory');
const Category = require('../models/Category');
const Product = require('../models/Product');
const { cloudinary } = require('../utils/cloudinary');

// Get all subcategories with pagination, search, and filtering
const getSubcategories = async (req, res) => {
  try {
    const { page = 1, limit = 10, search = '', category = '' } = req.query;

    const query = {};
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { slug: { $regex: search, $options: 'i' } },
      ];
    }
    if (category) {
      query.category = category;
    }

    console.log('Fetching subcategories with query:', query, 'Page:', page, 'Limit:', limit);
    const subcategories = await Subcategory.find(query)
      .populate('category', 'name slug')
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const total = await Subcategory.countDocuments(query);
    console.log('Total subcategories:', total);

    // Add product count for each subcategory
    const subcategoriesWithCounts = await Promise.all(
      subcategories.map(async (subcategory) => {
        const productCount = await Product.countDocuments({ subcategory: subcategory._id });
        return { ...subcategory._doc, productCount };
      })
    );

    res.status(200).json({
      subcategories: subcategoriesWithCounts,
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error('Error fetching subcategories:', error.message);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Get a single subcategory by ID
const getSubcategoryById = async (req, res) => {
  try {
    console.log('Fetching subcategory with ID:', req.params.id);
    const subcategory = await Subcategory.findById(req.params.id).populate('category', 'name slug');
    if (!subcategory) {
      return res.status(404).json({ message: 'Subcategory not found' });
    }
    res.status(200).json(subcategory);
  } catch (error) {
    console.error('Error fetching subcategory:', error.message);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Get a single subcategory by slug
const getSubcategoryBySlug = async (req, res) => {
  try {
    const { slug } = req.params;
    console.log('Fetching subcategory with slug:', slug);
    const subcategory = await Subcategory.findOne({ slug }).populate('category', 'name slug');
    if (!subcategory) {
      return res.status(404).json({ message: 'Subcategory not found' });
    }
    res.status(200).json(subcategory);
  } catch (error) {
    console.error('Error fetching subcategory by slug:', error.message);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Get subcategories by category ID or slug
const getSubcategoriesByCategory = async (req, res) => {
  try {
    const { categoryId } = req.params;
    let query;

    console.log('Fetching subcategories by category:', categoryId);

    // Check if categoryId is a valid ObjectId
    if (mongoose.Types.ObjectId.isValid(categoryId)) {
      query = { category: categoryId };
    } else {
      // Assume categoryId is a slug and find the category
      const category = await Category.findOne({ slug: categoryId });
      if (!category) {
        return res.status(404).json({ message: 'Category not found' });
      }
      query = { category: category._id };
    }

    const subcategories = await Subcategory.find(query).populate('category', 'name slug');
    res.status(200).json(subcategories);
  } catch (error) {
    console.error('Error fetching subcategories by category:', error.message);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Add a new subcategory
const addSubcategory = async (req, res) => {
  try {
    console.log('Adding subcategory - Request body:', req.body);
    console.log('Adding subcategory - Request files:', req.files);

    const { name, description, slug, category, status } = req.body;

    if (!name || !slug || !category) {
      return res.status(400).json({ message: 'Name, slug, and category are required' });
    }

    // Validate slug format
    if (!/^[a-z0-9-]+$/i.test(slug)) {
      return res.status(400).json({ message: 'Invalid slug format' });
    }

    // Validate category exists
    if (!mongoose.Types.ObjectId.isValid(category)) {
      return res.status(400).json({ message: 'Invalid category ID' });
    }
    const categoryExists = await Category.findById(category);
    if (!categoryExists) {
      return res.status(400).json({ message: 'Category not found' });
    }

    const existingSubcategory = await Subcategory.findOne({ slug, category });
    if (existingSubcategory) {
      return res.status(400).json({ message: 'Subcategory with this slug already exists in this category' });
    }

    let imageUrl = '';
    if (req.files && req.files.image && req.files.image[0]) {
      imageUrl = req.files.image[0].path; // Cloudinary URL
      console.log('Image uploaded:', imageUrl);
    }

    const subcategory = new Subcategory({
      name,
      description,
      slug,
      category,
      status: status || 'active',
      image: imageUrl,
    });

    await subcategory.save();
    const populatedSubcategory = await Subcategory.findById(subcategory._id).populate('category', 'name slug');
    res.status(201).json({ message: 'Subcategory added successfully', subcategory: populatedSubcategory });
  } catch (error) {
    console.error('Error adding subcategory:', error.message);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Update a subcategory
const updateSubcategory = async (req, res) => {
  try {
    console.log('Updating subcategory - Request body:', req.body);
    console.log('Updating subcategory - Request files:', req.files);

    const { name, description, slug, category, status, removeImage } = req.body;

    const subcategory = await Subcategory.findById(req.params.id);
    if (!subcategory) {
      return res.status(404).json({ message: 'Subcategory not found' });
    }

    if (slug && slug !== subcategory.slug) {
      // Validate slug format
      if (!/^[a-z0-9-]+$/i.test(slug)) {
        return res.status(400).json({ message: 'Invalid slug format' });
      }

      const existingSubcategory = await Subcategory.findOne({ slug, category: category || subcategory.category });
      if (existingSubcategory) {
        return res.status(400).json({ message: 'Subcategory with this slug already exists in this category' });
      }
    }

    // Validate category if provided
    if (category) {
      if (!mongoose.Types.ObjectId.isValid(category)) {
        return res.status(400).json({ message: 'Invalid category ID' });
      }
      const categoryExists = await Category.findById(category);
      if (!categoryExists) {
        return res.status(400).json({ message: 'Category not found' });
      }
    }

    if (req.files && req.files.image && req.files.image[0]) {
      if (subcategory.image) {
        const publicId = subcategory.image.split('/').pop().split('.')[0];
        await cloudinary.uploader.destroy(`ecommerce/${publicId}`);
      }
      subcategory.image = req.files.image[0].path;
    } else if (removeImage === 'true' && subcategory.image) {
      const publicId = subcategory.image.split('/').pop().split('.')[0];
      await cloudinary.uploader.destroy(`ecommerce/${publicId}`);
      subcategory.image = '';
    }

    subcategory.name = name || subcategory.name;
    subcategory.description = description || subcategory.description;
    subcategory.slug = slug || subcategory.slug;
    subcategory.category = category || subcategory.category;
    subcategory.status = status || subcategory.status;

    await subcategory.save();
    const populatedSubcategory = await Subcategory.findById(subcategory._id).populate('category', 'name slug');
    res.status(200).json({ message: 'Subcategory updated successfully', subcategory: populatedSubcategory });
  } catch (error) {
    console.error('Error updating subcategory:', error.message);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Delete a subcategory
const deleteSubcategory = async (req, res) => {
  try {
    console.log('Deleting subcategory with ID:', req.params.id);
    const subcategory = await Subcategory.findById(req.params.id);
    if (!subcategory) {
      return res.status(404).json({ message: 'Subcategory not found' });
    }

    const productCount = await Product.countDocuments({ subcategory: subcategory._id });
    if (productCount > 0) {
      return res.status(400).json({ message: 'Cannot delete subcategory with associated products' });
    }

    if (subcategory.image) {
      const publicId = subcategory.image.split('/').pop().split('.')[0];
      await cloudinary.uploader.destroy(`ecommerce/${publicId}`);
    }

    await Subcategory.deleteOne({ _id: subcategory._id });
    res.status(200).json({ message: 'Subcategory deleted successfully' });
  } catch (error) {
    console.error('Error deleting subcategory:', error.message);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

module.exports = {
  getSubcategories,
  getSubcategoryById,
  getSubcategoryBySlug, // Add this
  getSubcategoriesByCategory,
  addSubcategory,
  updateSubcategory,
  deleteSubcategory,
};