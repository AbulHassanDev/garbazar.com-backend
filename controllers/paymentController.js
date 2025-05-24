// controllers/paymentController.js
const User = require("../models/User");

const initiatePayment = async (req, res) => {
  const { membershipType, easypaisaNumber } = req.body;
  const userId = req.user._id;

  console.log("Initiate payment - User ID:", userId);
  console.log("Initiate payment - Membership Type:", membershipType);
  console.log("Initiate payment - EasyPaisa Number:", easypaisaNumber);

  try {
    if (!["monthly", "annual"].includes(membershipType)) {
      console.log("Invalid membership type:", membershipType);
      return res.status(400).json({ message: "Invalid membership type" });
    }

    const user = await User.findById(userId);
    if (!user) {
      console.log("User not found for ID:", userId);
      return res.status(404).json({ message: "User not found" });
    }

    if (user.type === "pro") {
      console.log("User is already a pro member:", userId);
      return res.status(400).json({ message: "User is already a pro member" });
    }

    if (user.membership?.paymentStatus === "pending") {
      console.log("User has a pending payment:", user.membership.orderRefNum);
      return res.status(400).json({
        message: "A payment is already pending for this user",
        orderRefNum: user.membership.orderRefNum,
      });
    }

    const amount = membershipType === "annual" ? 4999 : 499;
    const transactionId = `TXN-${Date.now()}-${userId}`;
    const orderRefNum = `ORD-${Date.now()}-${userId}`;

    console.log("Payment data:", { amount, transactionId, orderRefNum });

    console.log("Updating user membership:", { membershipType, orderRefNum });
    user.membership = {
      isPro: false,
      membershipType,
      startDate: new Date(),
      endDate: new Date(
        Date.now() + (membershipType === "annual" ? 365 * 24 * 60 * 60 * 1000 : 30 * 24 * 60 * 60 * 1000)
      ),
      paymentStatus: "pending",
      orderRefNum,
    };

    await user.save();
    console.log("User saved successfully:", user);

    res.status(200).json({
      orderRefNum,
      transactionId,
      paymentUrl: "http://localhost:5173/membership/mock-payment",
    });
  } catch (error) {
    console.error("Payment initiation error:", error.message, error.stack);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

const paymentCallback = async (req, res) => {
  const { orderRefNum, transactionId, status } = req.body;

  console.log("Payment callback - Data:", { orderRefNum, transactionId, status });

  try {
    const allUsers = await User.find({});
    console.log(
      "All users in DB:",
      allUsers.map((u) => ({
        email: u.email,
        membership: u.membership,
      }))
    );

    console.log("Querying for user with orderRefNum:", orderRefNum);
    const user = await User.findOne({ "membership.orderRefNum": orderRefNum });
    if (!user) {
      console.log("User not found for orderRefNum:", orderRefNum);
      return res.status(404).json({ message: "User not found" });
    }

    console.log("User found:", { email: user.email, orderRefNum: user.membership.orderRefNum });

    if (status === "completed") {
      user.type = "pro";
      user.membership.isPro = true;
      user.membership.paymentStatus = "completed";
      await user.save();
      console.log("User upgraded to pro:", { email: user.email, type: user.type });
      res.status(200).json({
        message: "Payment successful, membership upgraded",
        redirectUrl: "http://localhost:5173/membership/success",
      });
    } else {
      user.membership.paymentStatus = "failed";
      await user.save();
      console.log("Payment failed for user:", { email: user.email });
      res.status(400).json({ message: "Payment failed" });
    }
  } catch (error) {
    console.error("Payment callback error:", error.message, error.stack);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

const resetMembership = async (req, res) => {
  const userId = req.user._id;

  console.log("Reset membership - User ID:", userId);

  try {
    const user = await User.findById(userId);
    if (!user) {
      console.log("User not found for ID:", userId);
      return res.status(404).json({ message: "User not found" });
    }

    user.membership = {};
    await user.save();
    console.log("Membership reset for user:", user.email);

    res.status(200).json({ message: "Membership reset successfully" });
  } catch (error) {
    console.error("Reset membership error:", error.message, error.stack);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

module.exports = { initiatePayment, paymentCallback, resetMembership };