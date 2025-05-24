// routes/paymentRoutes.js
const express = require("express");
const router = express.Router();
const { initiatePayment, paymentCallback, resetMembership } = require("../controllers/paymentController");
const { protect } = require("../middleware/auth");

router.post("/initiate", protect, initiatePayment);
router.post("/callback", paymentCallback);
router.post("/reset-membership", protect, resetMembership);

// New endpoint for order payments
router.post("/initiate-order", protect, async (req, res) => {
  const { cartItems } = req.body;
  const userId = req.user._id;

  try {
    const user = await User.findById(userId).populate("cart.productId");
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const totalAmount = cartItems.reduce((total, item) => total + item.productId.price * item.quantity, 0);
    const orderRefNum = `ORD-${Date.now()}-${userId}`;

    const paymentData = {
      storeId: process.env.EASYPAISA_STORE_ID,
      amount: totalAmount.toString(),
      postBackURL: "http://localhost:5000/api/payment/callback-order",
      orderRefNum: orderRefNum,
      redirectURL: "http://localhost:5173/order/success",
      cancelURL: "http://localhost:5173/order/cancel",
      paymentMethod: "MA",
      hashKey: process.env.EASYPAISA_HASH_KEY,
    };

    const response = await axios.post(`${process.env.EASYPAISA_API_URL}/initiate`, paymentData, {
      headers: {
        Authorization: `Bearer ${process.env.EASYPAISA_TOKEN}`,
        "Content-Type": "application/json",
      },
    });

    const { paymentURL, transactionId } = response.data;

    // Save order details (you might want to create an Order model)
    user.cart = []; // Clear cart after initiating payment
    await user.save();

    res.status(200).json({
      orderRefNum,
      transactionId,
      paymentUrl: paymentURL,
    });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// Callback for order payments
router.post("/callback-order", async (req, res) => {
  const { orderRefNum, transactionId, status, paymentToken } = req.body;

  try {
    const verificationResponse = await axios.post(
      `${process.env.EASYPAISA_API_URL}/verify`,
      {
        storeId: process.env.EASYPAISA_STORE_ID,
        transactionId,
        paymentToken,
        hashKey: process.env.EASYPAISA_HASH_KEY,
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.EASYPAISA_TOKEN}`,
          "Content-Type": "application/json",
        },
      }
    );

    const { paymentStatus } = verificationResponse.data;
    if (paymentStatus !== "SUCCESS") {
      return res.status(400).json({ message: "Payment verification failed" });
    }

    // Here you would update the order status in an Order model
    res.status(200).json({
      message: "Order payment successful",
      redirectUrl: "http://localhost:5173/order/success",
    });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

module.exports = router;