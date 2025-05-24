const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const nodemailer = require("nodemailer");
const User = require("../models/User");

// Configure nodemailer for Gmail
const transporter = nodemailer.createTransport({
  service: process.env.EMAIL_SERVICE, // 'gmail' from .env
  auth: {
    user: process.env.EMAIL_USER, // malikabulhassan99@gmail.com
    pass: process.env.EMAIL_PASS, // New app-specific password
  },
});

// Register
const register = async (req, res) => {
  const { name, email, password, phone, type } = req.body;

  try {
    let user = await User.findOne({ email });
    if (user) {
      return res.status(400).json({ message: "User already exists" });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    user = new User({
      name,
      email,
      password: hashedPassword,
      phone,
      type: type && ["normal", "admin"].includes(type) ? type : "normal",
      membership: type === "pro" ? { isPro: true, membershipType: "monthly" } : {},
    });

    await user.save();

    const payload = {
      id: user._id,
      type: user.type,
    };
    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: "7d" });

    const userData = {
      id: user._id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      type: user.type,
      membership: user.membership,
    };

    res.status(201).json({ token, user: userData });
  } catch (error) {
    console.error("Register error:", error.message);
    res.status(500).json({ message: "Server error" });
  }
};

// Login
const login = async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    const payload = {
      id: user._id,
      type: user.type,
    };
    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: "7d" });

    const userData = {
      id: user._id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      type: user.type,
      membership: user.membership,
    };

    res.status(200).json({ token, user: userData });
  } catch (error) {
    console.error("Login error:", error.message);
    res.status(500).json({ message: "Server error" });
  }
};

// Forgot Password
const forgotPassword = async (req, res) => {
  const { email } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(20).toString("hex");
    user.resetPasswordToken = resetToken;
    user.resetPasswordExpires = Date.now() + 3600000; // 1 hour expiry
    await user.save();

    // Send reset email
    const resetUrl = `http://localhost:5173/reset-password/${resetToken}`; // Updated to frontend URL
    const mailOptions = {
      to: user.email,
      from: process.env.EMAIL_USER,
      subject: "Password Reset Request - Gil Groceries",
      html: `
        <p>Dear ${user.name},</p>
        <p>You requested a password reset for your Gil Groceries account.</p>
        <p>Please click the link below to reset your password:</p>
        <a href="${resetUrl}">${resetUrl}</a>
        <p>This link will expire in 1 hour.</p>
        <p>If you did not request this, please ignore this email.</p>
        <p>Best regards,<br>Gil Groceries Team</p>
      `,
    };

    transporter.sendMail(mailOptions, (error, info) => {
      if (error) {
        console.error("Email sending error:", error);
        return res.status(500).json({ message: "Failed to send email" });
      }
      console.log("Email sent:", info.response);
      res.status(200).json({ message: "Password reset email sent" });
    });
  } catch (error) {
    console.error("Forgot password error:", error.message);
    res.status(500).json({ message: "Server error" });
  }
};

// Reset Password
const resetPassword = async (req, res) => {
  const { token } = req.params;
  const { password } = req.body;

  try {
    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: Date.now() },
    });

    if (!user) {
      return res.status(400).json({ message: "Invalid or expired reset token" });
    }

    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(password, salt);
    user.resetPasswordToken = null;
    user.resetPasswordExpires = null;
    await user.save();

    res.status(200).json({ message: "Password reset successfully" });
  } catch (error) {
    console.error("Reset password error:", error.message);
    res.status(500).json({ message: "Server error" });
  }
};

// Get logged-in user
const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-password");
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    
    res.status(200).json({
      id: user._id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      type: user.type,
      membership: user.membership,
    });
  } catch (error) {
    console.error("GetMe error:", error.message);
    res.status(500).json({ message: "Server error" });
  }
};

// Upgrade to Pro
const upgradeToPro = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (user.type === "pro") {
      return res.status(400).json({ message: "User is already a pro member" });
    }

    if (user.type === "admin") {
      return res.status(400).json({ message: "Admins cannot upgrade to pro" });
    }

    user.type = "pro";
    user.membership = {
      isPro: true,
      membershipType: req.body.membershipType || "monthly",
      paymentStatus: "completed",
      startDate: new Date(),
      endDate: new Date(
        new Date().setFullYear(
          new Date().getFullYear() + (req.body.membershipType === "annual" ? 1 : 0)
        ).setMonth(
          new Date().getMonth() + (req.body.membershipType === "monthly" ? 1 : 0)
        )
      ),
    };

    await user.save();

    const payload = {
      id: user._id,
      type: user.type,
    };
    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: "7d" });

    res.status(200).json({
      message: "Account upgraded to Pro successfully",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        type: user.type,
        membership: user.membership,
      },
      token,
    });
  } catch (error) {
    console.error("Upgrade error:", error.message);
    res.status(500).json({ message: "Server error" });
  }
};

module.exports = { login, register, getMe, upgradeToPro, forgotPassword, resetPassword };