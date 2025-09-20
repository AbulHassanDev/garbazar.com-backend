
const mongoose = require("mongoose");
const Product = require("../models/Product");
const Category = require("../models/Category");
const Subcategory = require("../models/Subcategory");
const { cloudinary } = require("../utils/cloudinary");
const logger = require("../utils/logger");

const generateSlug = (name) => {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
};

const getProducts = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      category,
      subcategory,
      search = "",
      sort,
      minPrice,
      maxPrice,
      brands,
    } = req.query;
    const query = { status: "active" };

    if (category) query.category = category;
    if (subcategory) query.subcategory = subcategory;
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { sku: { $regex: search, $options: "i" } },
      ];
    }
    if (minPrice || maxPrice) {
      query.price = {};
      if (minPrice) query.price.$gte = parseFloat(minPrice);
      if (maxPrice) query.price.$lte = parseFloat(maxPrice);
    }
    if (brands) {
      query.brand = { $in: brands.split(",") };
    }

    console.log("Fetching products with query:", query, "Page:", page, "Limit:", limit);
    let sortOption = { createdAt: -1 };
    if (sort === "featured") sortOption = { featured: -1, createdAt: -1 };
    else if (sort === "name-asc") sortOption = { name: 1 };
    else if (sort === "name-desc") sortOption = { name: -1 };
    else if (sort === "price-asc") sortOption = { price: 1 };
    else if (sort === "price-desc") sortOption = { price: -1 };
    else if (sort === "stock-asc") sortOption = { stock: 1 };
    else if (sort === "stock-desc") sortOption = { stock: -1 };

    const products = await Product.find(query)
      .populate("category", "name slug")
      .populate("subcategory", "name slug")
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .sort(sortOption);

    const total = await Product.countDocuments(query);
    console.log("Total products:", total);

    res.status(200).json({
      products,
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error("Error fetching products:", error.message);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

const getFeaturedProducts = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    console.log("Fetching featured products:", { page, limit });
    const products = await Product.find({ featured: true, status: "active" })
      .populate("category", "name slug")
      .populate("subcategory", "name slug")
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .sort({ createdAt: -1 });

    const total = await Product.countDocuments({ featured: true, status: "active" });
    console.log("Total featured products:", total);

    res.status(200).json({
      products,
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error("Error fetching featured products:", error.message);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

const getSeasonalProducts = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    console.log("Fetching seasonal products:", { page, limit });
    const products = await Product.find({ seasonal: true, status: "active" })
      .populate("category", "name slug")
      .populate("subcategory", "name slug")
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .sort({ createdAt: -1 });

    const total = await Product.countDocuments({ seasonal: true, status: "active" });
    console.log("Total seasonal products:", total);

    res.status(200).json({
      products,
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error("Error fetching seasonal products:", error.message);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

const getProductById = async (req, res) => {
  try {
    const { id } = req.params;
    console.log("Fetching product with ID:", id);
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid product ID" });
    }

    const product = await Product.findById(id)
      .populate("category", "name slug")
      .populate("subcategory", "name slug");
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }
    res.status(200).json(product);
  } catch (error) {
    console.error("Error fetching product:", error.message);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

const getRelatedProducts = async (req, res) => {
  try {
    const { productId } = req.params;
    console.log("Fetching related products for product ID:", productId);
    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({ message: "Invalid product ID" });
    }

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    const query = {
      $or: [{ category: product.category }, { subcategory: product.subcategory }],
      _id: { $ne: productId },
      status: "active",
    };

    const products = await Product.find(query)
      .populate("category", "name slug")
      .populate("subcategory", "name slug")
      .limit(4)
      .sort({ createdAt: -1 });

    res.status(200).json({
      products,
      total: products.length,
    });
  } catch (error) {
    console.error("Error fetching related products:", error.message);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

const addProduct = async (req, res) => {
  try {
    console.log("Adding product - Request body:", req.body);
    console.log("Adding product - Request files:", req.files);

    const {
      name,
      description,
      price,
      originalPrice,
      sku,
      stock,
      category,
      subcategory,
      brand,
      specifications,
      featured,
      seasonal,
      status,
    } = req.body;

    if (!name || !price || !sku || !stock || !category || !subcategory) {
      return res.status(400).json({ message: "Name, price, SKU, stock, category, and subcategory are required" });
    }

    if (!mongoose.Types.ObjectId.isValid(category) || !mongoose.Types.ObjectId.isValid(subcategory)) {
      return res.status(400).json({ message: "Invalid category or subcategory ID" });
    }
    const categoryExists = await Category.findById(category);
    const subcategoryExists = await Subcategory.findById(subcategory);
    if (!categoryExists || !subcategoryExists) {
      return res.status(400).json({ message: "Category or subcategory not found" });
    }

    const existingSku = await Product.findOne({ sku });
    if (existingSku) {
      return res.status(400).json({ message: "SKU already exists" });
    }

    let slug = generateSlug(name);
    let slugSuffix = 1;
    let uniqueSlug = slug;
    while (await Product.findOne({ slug: uniqueSlug })) {
      uniqueSlug = `${slug}-${slugSuffix}`;
      slugSuffix++;
    }

    const images = req.files.map((file) => ({
      url: file.path,
      public_id: file.path.split("/").pop().split(".")[0],
    }));

    let parsedSpecifications = [];
    try {
      parsedSpecifications = specifications ? JSON.parse(specifications) : [];
      if (!Array.isArray(parsedSpecifications)) {
        throw new Error("Specifications must be an array");
      }
    } catch (error) {
      return res.status(400).json({ message: "Invalid specifications format" });
    }

    const product = new Product({
      name,
      slug: uniqueSlug,
      description,
      price: parseFloat(price),
      originalPrice: originalPrice ? parseFloat(originalPrice) : undefined,
      sku,
      stock: parseInt(stock),
      category,
      subcategory,
      brand,
      images,
      specifications: parsedSpecifications,
      featured: featured === "true" || featured === true,
      seasonal: seasonal === "true" || seasonal === true,
      status: status || "active",
    });

    const savedProduct = await product.save();
    const populatedProduct = await Product.findById(savedProduct._id)
      .populate("category", "name slug")
      .populate("subcategory", "name slug");
    res.status(201).json({ message: "Product added successfully", product: populatedProduct });
  } catch (error) {
    console.error("Error adding product:", error.message);
    if (error.name === "ValidationError") {
      const messages = Object.values(error.errors)
        .map((err) => err.message)
        .join(", ");
      return res.status(400).json({ message: `Validation failed: ${messages}` });
    }
    if (error.code === 11000) {
      return res.status(400).json({ message: "Duplicate key error: SKU or slug already exists" });
    }
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

const updateProduct = async (req, res) => {
  try {
    console.log("Updating product - Request body:", req.body);
    console.log("Updating product - Request files:", req.files);

    const { id } = req.params;
    const {
      name,
      description,
      price,
      originalPrice,
      sku,
      stock,
      category,
      subcategory,
      brand,
      specifications,
      featured,
      seasonal,
      status,
      existingImages,
    } = req.body;

    const product = await Product.findById(id);
    if (!product) {
      return res.status(400).json({ message: "Product not found" });
    }

    if (!name || !price || !sku || !stock || !category || !subcategory) {
      return res.status(400).json({ message: "Name, price, SKU, stock, category, and subcategory are required" });
    }

    if (!mongoose.Types.ObjectId.isValid(category) || !mongoose.Types.ObjectId.isValid(subcategory)) {
      return res.status(400).json({ message: "Invalid category or subcategory ID" });
    }
    const categoryExists = await Category.findById(category);
    const subcategoryExists = await Subcategory.findById(subcategory);
    if (!categoryExists || !subcategoryExists) {
      return res.status(400).json({ message: "Category or subcategory not found" });
    }

    if (sku && sku !== product.sku) {
      const existingSku = await Product.findOne({ sku });
      if (existingSku) {
        return res.status(400).json({ message: "SKU already exists" });
      }
    }

    if (name && name !== product.name) {
      let slug = generateSlug(name);
      let slugSuffix = 1;
      let uniqueSlug = slug;
      while (await Product.findOne({ slug: uniqueSlug, _id: { $ne: id } })) {
        uniqueSlug = `${slug}-${slugSuffix}`;
        slugSuffix++;
      }
      product.slug = uniqueSlug;
    }

    let images = [];
    if (existingImages) {
      let existing;
      try {
        existing = JSON.parse(existingImages);
        if (!Array.isArray(existing)) {
          throw new Error("existingImages must be an array");
        }
        images = existing.map((url) => ({
          url,
          public_id: url.split("/").pop().split(".")[0],
        }));
      } catch (error) {
        return res.status(400).json({ message: "Invalid existingImages format" });
      }
    }

    if (req.files && req.files.length > 0) {
      if (product.images && product.images.length > 0) {
        for (const img of product.images) {
          if (!images.some((existing) => existing.public_id === img.public_id)) {
            await cloudinary.uploader.destroy(`ecommerce/${img.public_id}`);
          }
        }
      }
      const newImages = req.files.map((file) => ({
        url: file.path,
        public_id: file.path.split("/").pop().split(".")[0],
      }));
      images = [...images, ...newImages];
    }

    let parsedSpecifications = product.specifications;
    try {
      if (specifications) {
        parsedSpecifications = JSON.parse(specifications);
        if (!Array.isArray(parsedSpecifications)) {
          throw new Error("Specifications must be an array");
        }
      }
    } catch (error) {
      return res.status(400).json({ message: "Invalid specifications format" });
    }

    product.name = name || product.name;
    product.description = description || product.description;
    product.price = price ? parseFloat(price) : product.price;
    product.originalPrice = originalPrice ? parseFloat(originalPrice) : product.originalPrice;
    product.sku = sku || product.sku;
    product.stock = stock ? parseInt(stock) : product.stock;
    product.category = category || product.category;
    product.subcategory = subcategory || product.subcategory;
    product.brand = brand || product.brand;
    product.images = images;
    product.specifications = parsedSpecifications;
    product.featured = featured !== undefined ? featured === "true" || featured === true : product.featured;
    product.seasonal = seasonal !== undefined ? seasonal === "true" || seasonal === true : product.seasonal;
    product.status = status || product.status;

    const updatedProduct = await product.save();
    const populatedProduct = await Product.findById(updatedProduct._id)
      .populate("category", "name slug")
      .populate("subcategory", "name slug");
    res.status(200).json({ message: "Product updated successfully", product: populatedProduct });
  } catch (error) {
    console.error("Error updating product:", error.message);
    if (error.name === "ValidationError") {
      const messages = Object.values(error.errors)
        .map((err) => err.message)
        .join(", ");
      return res.status(400).json({ message: `Validation failed: ${messages}` });
    }
    if (error.code === 11000) {
      return res.status(400).json({ message: "Duplicate key error: SKU or slug already exists" });
    }
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

const deleteProduct = async (req, res) => {
  try {
    const { id } = req.params;
    console.log("Deleting product with ID:", id);
    const product = await Product.findById(id);
    if (!product) {
      return res.status(400).json({ message: "Product not found" });
    }

    if (product.images && product.images.length > 0) {
      for (const img of product.images) {
        await cloudinary.uploader.destroy(`ecommerce/${img.public_id}`);
      }
    }

    await Product.deleteOne({ _id: id });
    res.status(200).json({ message: "Product deleted successfully" });
  } catch (error) {
    console.error("Error deleting product:", error.message);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

const getProductCount = async (req, res) => {
  try {
    const count = await Product.countDocuments();
    logger.info(`Product count fetched: ${count}`);
    res.status(200).json({ count });
  } catch (error) {
    logger.error(`Error fetching product count: ${error.message}`);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

module.exports = {
  getProducts,
  getProductById,
  addProduct,
  updateProduct,
  deleteProduct,
  getFeaturedProducts,
  getSeasonalProducts,
  getRelatedProducts,
  getProductCount,
};