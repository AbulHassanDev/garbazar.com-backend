
const mongoose = require("mongoose");
const Order = require("../models/Order");
const Product = require("../models/Product");
const User = require("../models/User");
const logger = require("../utils/logger");
const { sendOrderConfirmationEmail, sendOrderUpdateEmail } = require("../utils/email");

const validateOrder = (req, res, next) => {
  const { items, totalAmount, shippingAddress, paymentMethod } = req.body;
  logger.info(`Validating order request at ${new Date().toISOString()}`, { items, totalAmount, shippingAddress, paymentMethod });

  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ message: "Items are required and must be a non-empty array" });
  }
  if (!totalAmount || totalAmount < 0) {
    return res.status(400).json({ message: "Valid totalAmount is required" });
  }
  if (!shippingAddress) {
    return res.status(400).json({ message: "Shipping address is required" });
  }
  if (paymentMethod && !["cod", "stripe"].includes(paymentMethod)) {
    return res.status(400).json({ message: "Invalid payment method" });
  }
  for (const item of items) {
    if (!item.product || !mongoose.isValidObjectId(item.product)) {
      logger.warn(`Invalid product ID in item at ${new Date().toISOString()}: ${item.product}`);
      return res.status(400).json({ message: `Invalid product ID: ${item.product}` });
    }
    if (!item.quantity || item.quantity < 1) {
      return res.status(400).json({ message: "Each item must have a valid quantity" });
    }
    if (!item.price || item.price < 0) {
      return res.status(400).json({ message: "Each item must have a valid price" });
    }
  }
  next();
};

const createCheckoutOrder = async (req, res) => {
  const { items, totalAmount, shippingAddress, paymentMethod, paymentDetails, subtotal, deliveryCharge } = req.body;
  const userId = req.user._id;

  logger.info(`Received checkout request for user ${userId} at ${new Date().toISOString()}`, { items, totalAmount, shippingAddress, paymentMethod, paymentDetails, subtotal, deliveryCharge });

  try {
    for (const item of items) {
      const product = await Product.findById(item.product);
      if (!product) {
        logger.warn(`Product not found at ${new Date().toISOString()}: ${item.product}`);
        return res.status(404).json({ message: `Product ${item.product} not found` });
      }
      if (product.stock < item.quantity) {
        logger.warn(`Insufficient stock for product ${item.product} at ${new Date().toISOString()}: requested=${item.quantity}, available=${product.stock}`);
        return res.status(400).json({ message: `Insufficient stock for ${product.name}` });
      }
    }

    const orderNumber = `ORD-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const order = new Order({
      user: userId,
      items,
      subtotal: subtotal || 0,
      deliveryCharge: deliveryCharge || 199,
      totalAmount,
      shippingAddress,
      paymentMethod,
      paymentDetails: paymentDetails || { status: "Pending" },
      paymentStatus: paymentMethod === "cod" ? "Completed" : "Pending",
      status: paymentMethod === "cod" ? "Processing" : "Pending",
      orderNumber,
    });

    await order.save();
    logger.info(`Order saved at ${new Date().toISOString()}: ${order._id}, orderNumber: ${order.orderNumber}`);

    for (const item of items) {
      await Product.findByIdAndUpdate(item.product, {
        $inc: { stock: -item.quantity },
      });
    }

    const populatedOrder = await Order.findById(order._id)
      .populate("items.product", "name price")
      .lean();

    if (!populatedOrder) {
      logger.error(`Failed to populate order at ${new Date().toISOString()}: ${order._id}`);
      return res.status(500).json({ message: "Failed to retrieve order details" });
    }

    const formattedOrder = {
      _id: order._id,
      orderNumber: order.orderNumber,
      orderId: order.orderNumber,
      customer: { _id: userId },
      createdAt: order.createdAt,
      totalAmount: order.totalAmount || 0,
      subtotal: order.subtotal || 0,
      deliveryCharge: order.deliveryCharge || 0,
      status: order.status || "Pending",
      paymentStatus: order.paymentStatus || "Pending",
      shippingAddress: order.shippingAddress || {},
      paymentMethod: order.paymentMethod || "N/A",
      paymentDetails: order.paymentDetails || { status: "Pending" },
      items: populatedOrder.items || [],
    };

    res.status(201).json({ message: "Order created successfully", order: formattedOrder });
  } catch (error) {
    logger.error(`Error creating checkout order at ${new Date().toISOString()}`, { message: error.message, stack: error.stack, requestBody: req.body });
    res.status(500).json({ message: "Server error", error: error.message, details: error.stack });
  }
};

const updatePayment = async (req, res) => {
  const { orderId, paymentDetails } = req.body;
  logger.info(`Received update-payment request for order ${orderId} at ${new Date().toISOString()}`, { paymentDetails });

  try {
    const order = await Order.findById(orderId).populate("items.product", "name price");
    if (!order) {
      logger.warn(`Order not found at ${new Date().toISOString()}: ${orderId}`);
      return res.status(404).json({ message: "Order not found" });
    }

    order.paymentDetails = paymentDetails;
    order.paymentStatus = paymentDetails.status;

    if (order.paymentStatus === "Completed") {
      order.status = "Processing";
    }

    await order.save();
    logger.info(`Order updated at ${new Date().toISOString()}: ${order._id}`, { paymentDetails });

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

    // Send confirmation email for COD orders after payment update
    if (order.paymentMethod === "cod" && paymentDetails.status === "Completed") {
      const user = await User.findById(order.user).select("name email membership");
      if (user) {
        try {
          await sendOrderConfirmationEmail(formattedOrder, user);
        } catch (emailError) {
          logger.error(`Failed to send COD confirmation email for order ${order._id}: ${emailError.message}`);
          // Don't fail the response, just log the email error
        }
      } else {
        logger.warn(`User not found for email at ${new Date().toISOString()}: ${order.user}`);
      }
    }

    res.status(200).json({ message: "Payment details updated", order: formattedOrder });
  } catch (error) {
    logger.error(`Payment update error at ${new Date().toISOString()}`, { message: error.message, stack: error.stack });
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

const updateOrder = async (req, res) => {
  try {
    const { items, totalAmount, shippingAddress, status, paymentStatus, paymentMethod, paymentDetails, subtotal, deliveryCharge } = req.body;

    const order = await Order.findById(req.params.id).populate("items.product", "name price");
    if (!order) {
      return res.status(400).json({ message: "Order not found" });
    }

    const previousStatus = order.status; // Track previous status for email

    order.items = items || order.items;
    order.totalAmount = totalAmount || order.totalAmount;
    order.subtotal = subtotal || order.subtotal;
    order.deliveryCharge = deliveryCharge || order.deliveryCharge;
    order.shippingAddress = shippingAddress || order.shippingAddress;
    order.status = status || order.status;
    order.paymentStatus = paymentStatus || order.paymentStatus;
    order.paymentMethod = paymentMethod || order.paymentMethod;
    order.paymentDetails = paymentDetails || order.paymentDetails;

    await order.save();
    const populatedOrder = await Order.findById(order._id)
      .populate("items.product", "name price")
      .lean();

    const formattedOrder = {
      _id: order._id,
      orderNumber: order.orderNumber || order._id || "N/A",
      orderId: order.orderNumber || order._id || "N/A",
      totalAmount: order.totalAmount || 0,
      subtotal: order.subtotal || 0,
      deliveryCharge: order.deliveryCharge || 0,
      status: order.status || "Pending",
      paymentStatus: order.paymentStatus || "Pending",
      paymentMethod: order.paymentMethod || "N/A",
      paymentDetails: order.paymentDetails || { status: "Pending" },
      shippingAddress: order.shippingAddress || {},
      items: populatedOrder.items || [],
    };

    // Send update email if status changed
    if (status && status !== previousStatus) {
      const user = await User.findById(order.user).select("name email membership");
      if (user) {
        try {
          await sendOrderUpdateEmail(formattedOrder, user, status);
        } catch (emailError) {
          logger.error(`Failed to send order update email for order ${order._id}: ${emailError.message}`);
          // Don't fail the response, just log the email error
        }
      } else {
        logger.warn(`User not found for email at ${new Date().toISOString()}: ${order.user}`);
      }
    }

    res.status(200).json({ message: "Order updated successfully", order: formattedOrder });
  } catch (error) {
    logger.error(`Error updating order at ${new Date().toISOString()}:`, { message: error.message });
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

const getOrders = async (req, res) => {
  try {
    const { page = 1, limit = 10, search = "", status = "", sort = "-createdAt" } = req.query;
    const query = {};
    if (search) query.orderNumber = { $regex: search, $options: "i" };
    if (status) query.status = status;

    const orders = await Order.find(query)
      .populate("user", "name email")
      .populate("items.product", "name price")
      .sort(sort)
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const total = await Order.countDocuments(query);

    const formattedOrders = orders.map((order) => ({
      _id: order._id,
      orderNumber: order.orderNumber || order._id || "N/A",
      orderId: order.orderNumber || order._id || "N/A",
      customer: order.user || { name: "Unknown Customer", email: "N/A" },
      createdAt: order.createdAt || new Date(),
      totalAmount: order.totalAmount || 0,
      subtotal: order.subtotal || 0,
      deliveryCharge: order.deliveryCharge || 0,
      status: order.status || "Pending",
      paymentStatus: order.paymentStatus || "Pending",
      shippingAddress: order.shippingAddress || {},
      items: order.items || [],
    }));

    res.status(200).json({ orders: formattedOrders, total });
  } catch (error) {
    logger.error(`Error fetching orders at ${new Date().toISOString()}:`, { message: error.message });
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

const getOrderById = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate("user", "name email")
      .populate("items.product", "name price");

    if (!order) {
      logger.warn(`Order not found at ${new Date().toISOString()}: ${req.params.id}`);
      return res.status(400).json({ message: "Order not found" });
    }

    const formattedOrder = {
      _id: order._id,
      orderNumber: order.orderNumber || order._id || "N/A",
      orderId: order.orderNumber || order._id || "N/A",
      customer: order.user || { name: "Unknown Customer", email: "N/A" },
      createdAt: order.createdAt || new Date(),
      totalAmount: order.totalAmount || 0,
      subtotal: order.subtotal || 0,
      deliveryCharge: order.deliveryCharge || 0,
      status: order.status || "Pending",
      paymentStatus: order.paymentStatus || "Pending",
      shippingAddress: order.shippingAddress || {},
      paymentMethod: order.paymentMethod || "N/A",
      paymentDetails: order.paymentDetails || { status: "Pending" },
      items: order.items || [],
    };

    res.status(200).json(formattedOrder);
  } catch (error) {
    logger.error(`Error fetching order at ${new Date().toISOString()}:`, { message: error.message });
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

const getUserOrders = async (req, res) => {
  try {
    const userId = req.user._id;
    const { page = 1, limit = 10 } = req.query;

    const orders = await Order.find({ user: userId })
      .populate("user", "name email")
      .populate("items.product", "name price")
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const total = await Order.countDocuments({ user: userId });

    const formattedOrders = orders.map((order) => ({
      _id: order._id,
      orderNumber: order.orderNumber || order._id || "N/A",
      orderId: order.orderNumber || order._id || "N/A",
      createdAt: order.createdAt || new Date(),
      totalAmount: order.totalAmount || 0,
      subtotal: order.subtotal || 0,
      deliveryCharge: order.deliveryCharge || 0,
      status: order.status || "Pending",
      paymentStatus: order.paymentStatus || "Pending",
      shippingAddress: order.shippingAddress || {},
      items: order.items || [],
    }));

    res.status(200).json({ orders: formattedOrders, total });
  } catch (error) {
    logger.error(`Error fetching user orders at ${new Date().toISOString()}:`, { message: error.message });
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

const getUserProfile = async (req, res) => {
  try {
    const userId = req.user._id;
    logger.info(`Fetching profile for user ${userId}`);

    const user = await User.findById(userId)
      .select("name email phone address membership")
      .lean();

    if (!user) {
      logger.warn(`User not found: ${userId}`);
      return res.status(404).json({ message: "User not found" });
    }

    const userData = {
      name: user.name || "User",
      email: user.email || "No email set",
      phone: user.phone || "N/A",
      address: user.address || "123 Main Street, Karachi",
      membership: user.membership || { isPro: false, endDate: "2025-12-31" },
    };

    logger.info(`Profile fetched for ${userId}: ${userData.name}`);
    res.status(200).json(userData);
  } catch (error) {
    logger.error(`Profile fetch error for ${req.user._id}: ${error.message}`);
    res.status(500).json({ message: "Server error fetching profile" });
  }
};

const addOrder = async (req, res) => {
  try {
    const { userId, items, totalAmount, shippingAddress, status, paymentStatus, paymentMethod, paymentDetails, subtotal, deliveryCharge, orderNumber } = req.body;

    const order = new Order({
      user: userId,
      items,
      subtotal: subtotal || 0,
      deliveryCharge: deliveryCharge || 199,
      totalAmount,
      shippingAddress,
      status: status || "Pending",
      paymentStatus: paymentStatus || "Pending",
      paymentMethod,
      paymentDetails,
      orderNumber: orderNumber || `ORD-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    });

    await order.save();
    const populatedOrder = await Order.findById(order._id)
      .populate("items.product", "name price")
      .lean();

    const formattedOrder = {
      _id: order._id,
      orderNumber: order.orderNumber || order._id || "N/A",
      orderId: order.orderNumber || order._id || "N/A",
      totalAmount: order.totalAmount || 0,
      subtotal: order.subtotal || 0,
      deliveryCharge: order.deliveryCharge || 0,
      status: order.status || "Pending",
      paymentStatus: order.paymentStatus || "Pending",
      paymentMethod: order.paymentMethod || "N/A",
      paymentDetails: order.paymentDetails || { status: "Pending" },
      shippingAddress: order.shippingAddress || {},
      items: populatedOrder.items || [],
    };

    res.status(201).json({ message: "Order created successfully", order: formattedOrder });
  } catch (error) {
    logger.error(`Error creating order at ${new Date().toISOString()}:`, { message: error.message });
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

const deleteOrder = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) {
      return res.status(400).json({ message: "Order not found" });
    }

    await Order.deleteOne({ _id: req.params.id });
    res.status(200).json({ message: "Order deleted successfully" });
  } catch (error) {
    logger.error(`Error deleting order at ${new Date().toISOString()}:`, { message: error.message });
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

const getOrderCount = async (req, res) => {
  try {
    const count = await Order.countDocuments() || 0;
    logger.info(`Order count fetched at ${new Date().toISOString()}: ${count}`);
    res.status(200).json({ count });
  } catch (error) {
    logger.error(`Error fetching order count at ${new Date().toISOString()}:`, { message: error.message });
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

const getTotalSales = async (req, res) => {
  try {
    const totalSales = await Order.aggregate([
      { $match: { status: "Delivered" } },
      { $group: { _id: null, totalSales: { $sum: "$totalAmount" } } },
    ]);
    const total = totalSales[0]?.totalSales || 0;
    logger.info(`Total sales fetched at ${new Date().toISOString()}: ${total}`);
    res.status(200).json({ totalSales: total });
  } catch (error) {
    logger.error(`Error fetching total sales at ${new Date().toISOString()}:`, { message: error.message });
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

module.exports = {
  getOrders,
  getOrderById,
  getUserOrders,
  addOrder,
  updateOrder,
  deleteOrder,
  getOrderCount,
  getTotalSales,
  validateOrder,
  createCheckoutOrder,
  updatePayment,
  getUserProfile,
};