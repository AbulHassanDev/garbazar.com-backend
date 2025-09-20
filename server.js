
require('dotenv').config({ path: 'H:\\E-Commerece Website\\server\\.env' });
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const { cloudinary } = require("./utils/cloudinary");
const authRoutes = require("./routes/authRoutes");
const paymentRoutes = require("./routes/paymentRoutes");
const cartRoutes = require("./routes/cartRoutes");
const categoryRoutes = require("./routes/categoryRoutes");
const subcategoryRoutes = require("./routes/subcategoryRoutes");
const productRoutes = require("./routes/productRoutes");
const orderRoutes = require("./routes/orderRoutes");
const userRoutes = require("./routes/userRoutes");
const seedAdmin = require("./utils/seedAdmin");
const logger = require("./utils/logger"); 

const app = express();

// Validate environment variables
const requiredEnvVars = [
  'PORT',
  'MONGO_URI',
  'JWT_SECRET',
  'FRONTEND_URL',
  'CLOUDINARY_CLOUD_NAME',
  'CLOUDINARY_API_KEY',
  'CLOUDINARY_API_SECRET',
  'EMAIL_SERVICE',
  'EMAIL_USER',
  'EMAIL_PASS',
  'STRIPE_SECRET_KEY',
];
requiredEnvVars.forEach((varName) => {
  if (!process.env[varName]) {
    console.error(`Error: Environment variable ${varName} is not set.`);
    process.exit(1);
  }
});

console.log('Loaded Environment Variables at:', new Date().toISOString(), {
  PORT: process.env.PORT,
  MONGO_URI: process.env.MONGO_URI,
  JWT_SECRET: process.env.JWT_SECRET ? '****' : undefined,
  FRONTEND_URL: process.env.FRONTEND_URL,
  CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME,
  CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY,
  CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET ? '****' : undefined,
  EMAIL_SERVICE: process.env.EMAIL_SERVICE,
  EMAIL_USER: process.env.EMAIL_USER,
  EMAIL_PASS: process.env.EMAIL_PASS ? '****' : undefined,
  STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY ? '****' : undefined,
});

// Configure CORS
app.use(cors({ origin: process.env.FRONTEND_URL }));

// Parse JSON and URL-encoded bodies
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info(`Request: ${req.method} ${req.path} - Status: ${res.statusCode} - Time: ${duration}ms at ${new Date().toISOString()}`);
  });
  next();
});

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/payment", paymentRoutes);
app.use("/api/cart", cartRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/subcategories", subcategoryRoutes);
app.use("/api/products", productRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/users", userRoutes);

// Cloudinary test endpoint
app.post('/api/test-cloudinary', async (req, res) => {
  try {
    const result = await cloudinary.uploader.upload('https://picsum.photos/150', {
      folder: 'ecommerce',
    });
    logger.info(`Cloudinary test successful at ${new Date().toISOString()}`, { result });
    res.status(200).json({ message: 'Cloudinary test successful', result });
  } catch (error) {
    logger.error(`Cloudinary test error at ${new Date().toISOString()}`, { message: error.message, stack: error.stack });
    res.status(500).json({ message: 'Cloudinary test failed', error: error.message });
  }
});

// Connect to MongoDB
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    logger.info(`MongoDB connected to: ${conn.connection.db.databaseName} at ${new Date().toISOString()}`);
    await seedAdmin();
  } catch (err) {
    logger.error(`MongoDB connection error at ${new Date().toISOString()}`, { message: err.message, stack: err.stack });
    process.exit(1);
  }
};

connectDB();

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error(`Server error at ${new Date().toISOString()}`, { message: err.message, stack: err.stack, path: req.path, method: req.method });
  res.status(500).json({ message: 'Server error', error: err.message });
});

// 404 handler
app.use((req, res) => {
  logger.warn(`Route not found at ${new Date().toISOString()}: ${req.method} ${req.path}`);
  res.status(404).json({ message: "Route not found" });
});

const PORT = process.env.PORT || 5005;
app.listen(PORT, () => {
  logger.info(`Server running on port ${PORT} at ${new Date().toISOString()}`);
});// Fix Render root directory
