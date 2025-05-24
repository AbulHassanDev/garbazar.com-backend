const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const User = require("../models/User");

const seedAdmin = async () => {
  try {
    // Check if the admin user already exists
    const existingUser = await User.findOne({ email: "admin@alfatah.com" });
    if (existingUser) {
      console.log("Admin user already exists:", existingUser);
      return;
    }

    const hashedPassword = await bcrypt.hash("admin123", 10);
    await User.create({
      name: "Admin User",
      email: "admin@alfatah.com",
      password: hashedPassword,
      phone: "1234567890",
      type: "admin",
    });
    console.log("Admin user created successfully");
  } catch (err) {
    console.error("Error creating admin user:", err);
  }
};

module.exports = seedAdmin;

















