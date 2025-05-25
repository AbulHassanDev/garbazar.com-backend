
// require('dotenv').config({ path: 'H:\\E-Commerece Website\\server\\.env' });

// const express = require("express");
// const mongoose = require("mongoose");
// const cors = require("cors");
// const { cloudinary } = require("./utils/cloudinary");
// const authRoutes = require("./routes/authRoutes");
// const paymentRoutes = require("./routes/paymentRoutes");
// const cartRoutes = require("./routes/cartRoutes");
// const categoryRoutes = require("./routes/categoryRoutes");
// const subcategoryRoutes = require("./routes/subcategoryRoutes");
// const productRoutes = require("./routes/productRoutes");
// const orderRoutes = require("./routes/orderRoutes");
// const userRoutes = require("./routes/userRoutes");
// const seedAdmin = require("./utils/seedAdmin");

// console.log('Loaded Environment Variables:', {
//   PORT: process.env.PORT,
//   MONGO_URI: process.env.MONGO_URI,
//   JWT_SECRET: process.env.JWT_SECRET ? '****' : undefined,
//   CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME,
//   CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY,
//   CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET ? '****' : undefined,
//   EMAIL_SERVICE: process.env.EMAIL_SERVICE,
//   EMAIL_USER: process.env.EMAIL_USER,
//   EMAIL_PASS: process.env.EMAIL_PASS ? '****' : undefined,
// });

// const app = express();

// app.use(cors());
// app.use(express.json());
// app.use(express.urlencoded({ extended: true }));

// app.use("/api/auth", authRoutes);
// app.use("/api/payment", paymentRoutes);
// app.use("/api/cart", cartRoutes);
// app.use("/api/categories", categoryRoutes);
// app.use("/api/subcategories", subcategoryRoutes);
// app.use("/api/products", productRoutes);
// app.use("/api/orders", orderRoutes);
// app.use("/api/users", userRoutes);

// app.post('/api/test-cloudinary', async (req, res) => {
//   try {
//     const result = await cloudinary.uploader.upload('https://picsum.photos/150', {
//       folder: 'ecommerce',
//     });
//     res.status(200).json({ message: 'Cloudinary test successful', result });
//   } catch (error) {
//     console.error('Cloudinary test error:', error.message, error.stack);
//     res.status(500).json({ message: 'Cloudinary test failed', error: error.message });
//   }
// });

// const connectDB = async () => {
//   try {
//     const conn = await mongoose.connect(process.env.MONGO_URI);
//     console.log("MongoDB connected to:", conn.connection.db.databaseName);
//     await seedAdmin();
//   } catch (err) {
//     console.error("MongoDB connection error:", err);
//     process.exit(1);
//   }
// };

// connectDB();

// app.use((err, req, res, next) => {
//   console.error('Server error:', err.message, err.stack);
//   res.status(500).json({ message: 'Server error', error: err.message });
// });

// app.use((req, res) => {
//   res.status(404).json({ message: "Route not found" });
// });

// const PORT = process.env.PORT || 5005;
// app.listen(PORT, () => {
//   console.log(`Server running on port ${PORT}`);
// });












require('dotenv').config();

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

// Debug: Show loaded environment variables (masked)
console.log('Loaded Environment Variables:', {
  PORT: process.env.PORT,
  MONGO_URI: process.env.MONGO_URI,
  JWT_SECRET: process.env.JWT_SECRET ? '****' : undefined,
  CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME,
  CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY,
  CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET ? '****' : undefined,
  EMAIL_SERVICE: process.env.EMAIL_SERVICE,
  EMAIL_USER: process.env.EMAIL_USER,
  EMAIL_PASS: process.env.EMAIL_PASS ? '****' : undefined,
});

const app = express();

// ✅ Allow only your Vercel frontend in production
app.use(cors({
  origin: process.env.FRONTEND_URL || 'https://gar-bazar-com.vercel.app',
  credentials: true,
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ✅ API Routes
app.use("/api/auth", authRoutes);
app.use("/api/payment", paymentRoutes);
app.use("/api/cart", cartRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/subcategories", subcategoryRoutes);
app.use("/api/products", productRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/users", userRoutes);

// ✅ Test Cloudinary Upload Endpoint (optional for dev)
app.post('/api/test-cloudinary', async (req, res) => {
  try {
    const result = await cloudinary.uploader.upload('https://picsum.photos/150', {
      folder: 'ecommerce',
    });
    res.status(200).json({ message: 'Cloudinary test successful', result });
  } catch (error) {
    console.error('Cloudinary test error:', error.message);
    res.status(500).json({ message: 'Cloudinary test failed', error: error.message });
  }
});

// ✅ MongoDB Connection
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI);
    console.log("MongoDB connected to:", conn.connection.db.databaseName);
    await seedAdmin(); // seed admin user if not exists
  } catch (err) {
    console.error("MongoDB connection error:", err.message);
    process.exit(1);
  }
};
connectDB();

// ✅ Global Error Handler
app.use((err, req, res, next) => {
  console.error('Server error:', err.message);
  res.status(500).json({ message: 'Server error', error: err.message });
});

// ✅ 404 Not Found Handler
app.use((req, res) => {
  res.status(404).json({ message: "Route not found" });
});

// ✅ Start Server
const PORT = process.env.PORT || 5005;
app.listen(PORT, () => {
  console.log(`🚀 GarBazar backend running on port ${PORT}`);
});
