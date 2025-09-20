
const Order = require("../models/Order");
const User = require("../models/User");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const logger = require("../utils/logger");
const { sendOrderConfirmationEmail } = require("../utils/email");

const createPaymentIntent = async (req, res) => {
  try {
    const { orderId, amount } = req.body;
    const userId = req.user._id;

    logger.info(`Creating payment intent for order ${orderId} at ${new Date().toISOString()}`, { amount, userId });

    if (!orderId || amount == null) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields (orderId or amount)",
      });
    }

    const paymentAmount = Number(amount);
    if (isNaN(paymentAmount) || paymentAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid amount provided",
      });
    }

    const order = await Order.findOne({ _id: orderId, user: userId });
    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    if (order.paymentStatus === "Completed") {
      return res.status(400).json({
        success: false,
        message: "Order is already paid",
      });
    }

    const currency = "pkr";
    const finalAmount = Math.round(paymentAmount * 100);
    logger.info(`Final amount for Stripe: ${finalAmount} paisa`);

    const paymentIntent = await stripe.paymentIntents.create({
      amount: finalAmount,
      currency: currency,
      metadata: {
        userId: userId.toString(),
        orderId: orderId.toString(),
        orderNumber: order.orderNumber,
      },
      description: `Order #${order.orderNumber}`,
    });

    logger.info(`Stripe payment intent created at ${new Date().toISOString()}`, { id: paymentIntent.id, status: paymentIntent.status });

    order.paymentDetails.intentId = paymentIntent.id;
    order.paymentDetails.status = "Pending";
    await order.save();

    res.status(200).json({
      success: true,
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      currency: currency,
    });
  } catch (error) {
    logger.error(`Payment intent creation error at ${new Date().toISOString()}`, { message: error.message, stack: error.stack });
    res.status(500).json({
      success: false,
      message: "Payment processing failed",
      error: error.message,
    });
  }
};

const createMembershipPaymentIntent = async (req, res) => {
  try {
    const { membershipType, email } = req.body;
    const userId = req.user._id;

    logger.info(`Creating membership payment intent for user ${userId} at ${new Date().toISOString()}`, { membershipType });

    if (!membershipType || !["monthly", "annual"].includes(membershipType)) {
      return res.status(400).json({
        success: false,
        message: "Invalid or missing membership type",
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      logger.warn(`User not found at ${new Date().toISOString()}: ${userId}`);
      return res.status(404).json({ message: "User not found" });
    }

    if (user.membership?.isPro && user.membership?.endDate > new Date()) {
      return res.status(400).json({
        success: false,
        message: "User already has an active membership",
      });
    }

    const amount = membershipType === "annual" ? 499900 : 49900; // Rs.4,999 or Rs.499 in cents
    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency: "pkr",
      metadata: {
        userId: userId.toString(),
        membershipType,
      },
      description: `${membershipType.charAt(0).toUpperCase() + membershipType.slice(1)} Membership`,
      receipt_email: email,
    });

    logger.info(`Stripe membership payment intent created at ${new Date().toISOString()}`, { id: paymentIntent.id });

    res.status(200).json({
      success: true,
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
    });
  } catch (error) {
    logger.error(`Membership payment intent creation error at ${new Date().toISOString()}`, { message: error.message, stack: error.stack });
    res.status(500).json({
      success: false,
      message: "Payment processing failed",
      error: error.message,
    });
  }
};

const confirmPayment = async (req, res) => {
  try {
    const { paymentIntentId, orderId } = req.body;
    const userId = req.user._id;

    logger.info(`Confirming payment ${paymentIntentId} for order ${orderId} at ${new Date().toISOString()}`);

    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
    if (paymentIntent.status !== "succeeded") {
      return res.status(400).json({
        success: false,
        message: `Payment not completed. Status: ${paymentIntent.status}`,
      });
    }

    const order = await Order.findOne({ _id: orderId, user: userId }).populate("items.product", "name price");
    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    order.paymentStatus = "Completed";
    order.paymentDetails = {
      transactionId: paymentIntent.id,
      status: "Completed",
      method: "card",
      amount: paymentIntent.amount / 100,
      currency: paymentIntent.currency,
      timestamp: new Date(),
    };
    order.status = "Processing";
    await order.save();

    const formattedOrder = {
      _id: order._id,
      orderNumber: order.orderNumber,
      orderId: order.orderNumber,
      totalAmount: order.totalAmount || 0,
      subtotal: order.subtotal || 0,
      deliveryCharge: order.deliveryCharge || 0,
      status: order.status || "Pending",
      paymentStatus: order.paymentStatus || "Pending",
      paymentMethod: order.paymentMethod || "N/A",
      paymentDetails: order.paymentDetails || { status: "Pending" },
      shippingAddress: order.shippingAddress || {},
      items: order.items || [],
    };

    // Send confirmation email for Stripe orders
    const user = await User.findById(userId).select("name email membership");
    if (user) {
      try {
        await sendOrderConfirmationEmail(formattedOrder, user);
      } catch (emailError) {
        logger.error(`Failed to send Stripe confirmation email for order ${order._id}: ${emailError.message}`);
        // Don't fail the response, just log the email error
      }
    } else {
      logger.warn(`User not found for email at ${new Date().toISOString()}: ${userId}`);
    }

    await User.findByIdAndUpdate(userId, { $set: { cart: [] } });

    logger.info(`Payment confirmed successfully for order ${orderId} at ${new Date().toISOString()}`);
    res.status(200).json({
      success: true,
      message: "Payment confirmed successfully",
      order: formattedOrder,
    });
  } catch (error) {
    logger.error(`Payment confirmation error at ${new Date().toISOString()}`, { message: error.message, stack: error.stack });
    res.status(500).json({
      success: false,
      message: "Payment confirmation failed",
      error: error.message,
    });
  }
};

module.exports = {
  createPaymentIntent,
  createMembershipPaymentIntent,
  confirmPayment,
};