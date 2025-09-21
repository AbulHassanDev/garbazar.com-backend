const mongoose = require('mongoose');
const seedAdmin = require('../utils/seedAdmin'); // Adjust path as needed

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('MongoDB connected successfully to:', conn.connection.db.databaseName);
    
    // Seed admin after successful connection
    await seedAdmin();
    console.log('Admin seeding completed');
    
    return conn;
  } catch (error) {
    console.error('MongoDB connection error:', error.message);
    process.exit(1);
  }
};

module.exports = connectDB;