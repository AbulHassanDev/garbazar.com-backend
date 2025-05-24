const Order = require("../models/Order");
const logger = require("../utils/logger");

// Validation middleware for POST and PUT requests
const validateOrder = (req, res, next) => {
  const { userId, items, totalAmount, shippingAddress, status, paymentStatus } = req.body;
  if (!userId || !items || !Array.isArray(items) || items.length === 0 || !totalAmount || !shippingAddress) {
    return res.status(400).json({ message: "Missing required fields: userId, items, totalAmount, shippingAddress" });
  }
  for (const item of items) {
    if (!item.product || !item.quantity || !item.price) {
      return res.status(400).json({ message: "Each item must have product, quantity, and price" });
    }
  }
  next();
};

// Fetch all orders with pagination and search
const getOrders = async (req, res) => {
  try {
    const { page = 1, limit = 10, search = "" } = req.query;
    const query = search ? { orderNumber: { $regex: search, $options: "i" } } : {};

    const orders = await Order.find(query)
      .populate("user", "name email")
      .populate("items.product", "name price")
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const total = await Order.countDocuments(query);

    const formattedOrders = orders.map((order) => ({
      _id: order._id,
      orderId: order.orderNumber,
      customer: order.user,
      createdAt: order.createdAt,
      total: order.totalAmount,
      status: order.status,
      paymentStatus: order.paymentStatus,
      shippingAddress: order.shippingAddress,
    }));

    res.status(200).json({ orders: formattedOrders, total });
  } catch (error) {
    logger.error(`Error fetching orders: ${error.message}`);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Fetch a single order by ID
const getOrderById = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate("user", "name email")
      .populate("items.product", "name price");

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    const formattedOrder = {
      _id: order._id,
      orderId: order.orderNumber,
      customer: order.user,
      createdAt: order.createdAt,
      total: order.totalAmount,
      status: order.status,
      paymentStatus: order.paymentStatus,
      shippingAddress: order.shippingAddress,
      items: order.items,
    };

    res.status(200).json(formattedOrder);
  } catch (error) {
    logger.error(`Error fetching order: ${error.message}`);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Fetch orders for a specific user
const getUserOrders = async (req, res) => {
  try {
    const userId = req.user.id; // From protect middleware
    const { page = 1, limit = 10 } = req.query;

    const orders = await Order.find({ user: userId })
      .populate("user", "name email")
      .populate("items.product", "name price")
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const total = await Order.countDocuments({ user: userId });

    const formattedOrders = orders.map((order) => ({
      _id: order._id,
      orderId: order.orderNumber,
      createdAt: order.createdAt,
      total: order.totalAmount,
      status: order.status,
      paymentStatus: order.paymentStatus,
      shippingAddress: order.shippingAddress,
      items: order.items,
    }));

    res.status(200).json({ orders: formattedOrders, total });
  } catch (error) {
    logger.error(`Error fetching user orders: ${error.message}`);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Add a new order
const addOrder = async (req, res) => {
  try {
    const { userId, items, totalAmount, shippingAddress, status, paymentStatus } = req.body;

    const orderNumber = `ORD-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    const order = new Order({
      orderNumber,
      user: userId,
      items,
      totalAmount,
      shippingAddress,
      status: status || "Pending",
      paymentStatus: paymentStatus || "Pending",
    });

    await order.save();
    res.status(201).json({ message: "Order created successfully", order });
  } catch (error) {
    logger.error(`Error creating order: ${error.message}`);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Update an order
const updateOrder = async (req, res) => {
  try {
    const { items, totalAmount, shippingAddress, status, paymentStatus } = req.body;

    const order = await Order.findById(req.params.id);
    if (!order) {
      return res.status(400).json({ message: "Order not found" });
    }

    order.items = items || order.items;
    order.totalAmount = totalAmount || order.totalAmount;
    order.shippingAddress = shippingAddress || order.shippingAddress;
    order.status = status || order.status;
    order.paymentStatus = paymentStatus || order.paymentStatus;

    await order.save();
    res.status(200).json({ message: "Order updated successfully", order });
  } catch (error) {
    logger.error(`Error updating order: ${error.message}`);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Delete an order
const deleteOrder = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) {
      return res.status(400).json({ message: "Order not found" });
    }

    await Order.deleteOne({ _id: req.params.id });
    res.status(200).json({ message: "Order deleted successfully" });
  } catch (error) {
    logger.error(`Error deleting order: ${error.message}`);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Get total order count
const getOrderCount = async (req, res) => {
  try {
    const count = await Order.countDocuments();
    logger.info(`Order count fetched: ${count}`);
    res.status(200).json({ count });
  } catch (error) {
    logger.error(`Error fetching order count: ${error.message}`);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Get total sales
const getTotalSales = async (req, res) => {
  try {
    const totalSales = await Order.aggregate([
      { $match: { status: "Delivered" } },
      { $group: { _id: null, totalSales: { $sum: "$totalAmount" } } },
    ]);
    const total = totalSales[0]?.totalSales || 0;
    logger.info(`Total sales fetched: ${total}`);
    res.status(200).json({ totalSales: total });
  } catch (error) {
    logger.error(`Error fetching total sales: ${error.message}`);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

module.exports = { getOrders, getOrderById, getUserOrders, addOrder, updateOrder, deleteOrder, getOrderCount, getTotalSales, validateOrder };