
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const User = require("../models/User");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const logger = require("../utils/logger");
const { sendPasswordResetEmail } = require("../utils/email");

const generateToken = (user) => {
  return jwt.sign({ id: user._id, type: user.type }, process.env.JWT_SECRET, {
    expiresIn: "7d",
  });
};

const register = async (req, res) => {
  const { name, email, password, phone, type } = req.body;

  try {
    let user = await User.findOne({ email });
    if (user) {
      logger.warn(`Registration attempt with existing email at ${new Date().toISOString()}: ${email}`);
      return res.status(400).json({ success: false, message: "User already exists" });
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

    const token = generateToken(user);
    const userData = {
      id: user._id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      type: user.type,
      membership: user.membership,
    };

    logger.info(`User registered at ${new Date().toISOString()}: ${user._id}`);
    res.status(201).json({ success: true, token, user: userData });
  } catch (error) {
    logger.error(`Register error at ${new Date().toISOString()}: ${error.message}`);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

const login = async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email }).select("+password");
    if (!user) {
      logger.warn(`Login attempt with invalid email at ${new Date().toISOString()}: ${email}`);
      return res.status(400).json({ success: false, message: "Invalid credentials" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      logger.warn(`Invalid password attempt for user at ${new Date().toISOString()}: ${email}`);
      return res.status(400).json({ success: false, message: "Invalid credentials" });
    }

    const token = generateToken(user);
    const userData = {
      id: user._id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      type: user.type,
      membership: user.membership,
    };

    logger.info(`User logged in at ${new Date().toISOString()}: ${user._id}`);
    res.status(200).json({ success: true, token, user: userData });
  } catch (error) {
    logger.error(`Login error at ${new Date().toISOString()}: ${error.message}`);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

const forgotPassword = async (req, res) => {
  const { email } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user) {
      logger.warn(`Password reset attempt for non-existent user at ${new Date().toISOString()}: ${email}`);
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const resetToken = crypto.randomBytes(20).toString("hex");
    user.resetPasswordToken = resetToken;
    user.resetPasswordExpires = Date.now() + 3600000;
    await user.save();

    try {
      await sendPasswordResetEmail(user, resetToken);
      logger.info(`Password reset email sent to ${user.email} at ${new Date().toISOString()}`);
      res.status(200).json({ success: true, message: "Password reset email sent" });
    } catch (emailError) {
      logger.error(`Failed to send password reset email to ${user.email} at ${new Date().toISOString()}: ${emailError.message}`);
      res.status(500).json({ success: false, message: "Failed to send password reset email" });
    }
  } catch (error) {
    logger.error(`Forgot password error at ${new Date().toISOString()}: ${error.message}`);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

const resetPassword = async (req, res) => {
  const { token } = req.params;
  const { password } = req.body;

  try {
    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: Date.now() },
    });

    if (!user) {
      logger.warn(`Invalid or expired reset token at ${new Date().toISOString()}: ${token}`);
      return res.status(400).json({ success: false, message: "Invalid or expired reset token" });
    }

    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(password, salt);
    user.resetPasswordToken = null;
    user.resetPasswordExpires = null;
    await user.save();

    logger.info(`Password reset for user ${user._id} at ${new Date().toISOString()}`);
    res.status(200).json({ success: true, message: "Password reset successfully" });
  } catch (error) {
    logger.error(`Reset password error at ${new Date().toISOString()}: ${error.message}`);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-password");
    if (!user) {
      logger.warn(`User not found at ${new Date().toISOString()}: ${req.user.id}`);
      return res.status(404).json({ success: false, message: "User not found" });
    }

    if (user.membership?.isPro && user.membership.endDate < new Date()) {
      user.membership.isPro = false;
      user.membership.paymentStatus = "expired";
      user.type = "normal";
      await user.save();
      logger.info(`Membership expired for user ${user._id} at ${new Date().toISOString()}`);
    }

    const userData = {
      id: user._id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      type: user.type,
      membership: user.membership,
    };

    res.status(200).json({ success: true, user: userData });
  } catch (error) {
    logger.error(`GetMe error at ${new Date().toISOString()}: ${error.message}`);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

const upgradeToPro = async (req, res) => {
  try {
    const { paymentIntentId } = req.body;
    const userId = req.user.id;

    logger.info(`Upgrading user ${userId} to pro at ${new Date().toISOString()}`);

    if (!paymentIntentId) {
      logger.warn(`Missing paymentIntentId for user ${userId} at ${new Date().toISOString()}`);
      return res.status(400).json({ success: false, message: "Payment intent ID required" });
    }

    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
    if (paymentIntent.status !== "succeeded") {
      logger.warn(`Payment not successful for user ${userId} at ${new Date().toISOString()}: ${paymentIntent.status}`);
      return res.status(400).json({ success: false, message: `Payment not successful. Status: ${paymentIntent.status}` });
    }

    if (paymentIntent.metadata.userId !== userId.toString()) {
      logger.warn(`Unauthorized payment attempt for user ${userId} at ${new Date().toISOString()}`);
      return res.status(403).json({ success: false, message: "Unauthorized payment" });
    }

    const user = await User.findById(userId);
    if (!user) {
      logger.warn(`User not found at ${new Date().toISOString()}: ${userId}`);
      return res.status(404).json({ success: false, message: "User not found" });
    }

    if (user.membership?.isPro && user.membership?.endDate > new Date()) {
      logger.warn(`User ${userId} already has active membership at ${new Date().toISOString()}`);
      return res.status(400).json({ success: false, message: "User already has an active membership" });
    }

    const membershipType = paymentIntent.metadata.membershipType;
    if (!["monthly", "annual"].includes(membershipType)) {
      logger.warn(`Invalid membership type for user ${userId} at ${new Date().toISOString()}: ${membershipType}`);
      return res.status(400).json({ success: false, message: "Invalid membership type" });
    }

    const startDate = new Date();
    const endDate = new Date();
    endDate.setFullYear(startDate.getFullYear() + (membershipType === "annual" ? 1 : 0));
    endDate.setMonth(startDate.getMonth() + (membershipType === "monthly" ? 1 : 0));

    user.membership = {
      isPro: true,
      membershipType,
      paymentStatus: "completed",
      orderRefNum: paymentIntent.id,
      startDate,
      endDate,
    };
    user.type = "pro";
    await user.save();

    const userData = {
      id: user._id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      type: user.type,
      membership: user.membership,
    };

    const token = generateToken(user);
    logger.info(`User ${userId} upgraded to pro at ${new Date().toISOString()}`);
    res.status(200).json({ success: true, user: userData, token });
  } catch (error) {
    logger.error(`Upgrade to pro error at ${new Date().toISOString()}: ${error.message}`);
    res.status(500).json({ success: false, message: "Upgrade failed", error: error.message });
  }
};

module.exports = { login, register, getMe, upgradeToPro, forgotPassword, resetPassword };