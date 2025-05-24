const Cart = require("../models/Cart");
const Product = require("../models/Product");
const logger = require("../utils/logger");

exports.addToCart = async (req, res) => {
  const { productId, quantity } = req.body;
  const userId = req.user._id;

  try {
    if (!productId || !quantity || quantity < 1) {
      logger.warn(`Invalid input: productId=${productId}, quantity=${quantity}`);
      return res.status(400).json({ message: "Product ID and quantity are required" });
    }

    const product = await Product.findById(productId);
    if (!product || product.status !== "active") {
      logger.warn(`Product not found or inactive: ${productId}`);
      return res.status(404).json({ message: "Product not found or inactive" });
    }

    if (product.stock < quantity) {
      logger.warn(`Insufficient stock for product ${productId}: requested=${quantity}, available=${product.stock}`);
      return res.status(400).json({ message: `Only ${product.stock} items available in stock` });
    }

    let cart = await Cart.findOne({ userId });
    if (!cart) {
      cart = new Cart({ userId, items: [] });
    }

    const existingItem = cart.items.find((item) => item.productId.toString() === productId);
    if (existingItem) {
      const newQuantity = existingItem.quantity + quantity;
      if (product.stock < newQuantity) {
        logger.warn(`Insufficient stock for product ${productId}: requested=${newQuantity}, available=${product.stock}`);
        return res.status(400).json({ message: `Only ${product.stock} items available in stock` });
      }
      existingItem.quantity = newQuantity;
    } else {
      cart.items.push({ productId, quantity });
    }

    await cart.save();
    const populatedCart = await Cart.findOne({ userId }).populate("items.productId");
    logger.info(`Item added to cart for user ${userId}: product=${productId}, quantity=${quantity}`);
    res.status(200).json({ message: "Item added to cart", cart: populatedCart.items });
  } catch (error) {
    logger.error(`Error adding to cart: ${error.message}, stack: ${error.stack}`);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

exports.getCart = async (req, res) => {
  const userId = req.user._id;

  try {
    logger.info(`Fetching cart for user: ${userId}`);
    const cart = await Cart.findOne({ userId }).populate("items.productId");
    if (!cart) {
      logger.info(`No cart found for user: ${userId}, returning empty cart`);
      return res.status(200).json({ cart: [] });
    }

    res.status(200).json({ cart: cart.items });
  } catch (error) {
    logger.error(`Error fetching cart: ${error.message}, stack: ${error.stack}`);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

exports.updateCartItem = async (req, res) => {
  const { productId, quantity } = req.body;
  const userId = req.user._id;

  try {
    if (!productId || quantity === undefined) {
      logger.warn(`Invalid input: productId=${productId}, quantity=${quantity}`);
      return res.status(400).json({ message: "Product ID and quantity are required" });
    }

    const cart = await Cart.findOne({ userId });
    if (!cart) {
      logger.warn(`Cart not found for user: ${userId}`);
      return res.status(404).json({ message: "Cart not found" });
    }

    const product = await Product.findById(productId);
    if (!product || product.status !== "active") {
      logger.warn(`Product not found or inactive: ${productId}`);
      return res.status(404).json({ message: "Product not found or inactive" });
    }

    const cartItem = cart.items.find((item) => item.productId.toString() === productId);
    if (!cartItem) {
      logger.warn(`Item not found in cart: productId=${productId}, user=${userId}`);
      return res.status(404).json({ message: "Item not found in cart" });
    }

    if (quantity <= 0) {
      cart.items = cart.items.filter((item) => item.productId.toString() !== productId);
    } else {
      if (product.stock < quantity) {
        logger.warn(`Insufficient stock for product ${productId}: requested=${quantity}, available=${product.stock}`);
        return res.status(400).json({ message: `Only ${product.stock} items available in stock` });
      }
      cartItem.quantity = quantity;
    }

    await cart.save();
    const populatedCart = await Cart.findOne({ userId }).populate("items.productId");
    logger.info(`Cart updated for user ${userId}: product=${productId}, quantity=${quantity}`);
    res.status(200).json({ message: "Cart updated", cart: populatedCart.items });
  } catch (error) {
    logger.error(`Error updating cart: ${error.message}, stack: ${error.stack}`);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

exports.removeCartItem = async (req, res) => {
  const { productId } = req.params;
  const userId = req.user._id;

  try {
    const cart = await Cart.findOne({ userId });
    if (!cart) {
      logger.warn(`Cart not found for user: ${userId}`);
      return res.status(404).json({ message: "Cart not found" });
    }

    cart.items = cart.items.filter((item) => item.productId.toString() !== productId);
    await cart.save();
    const populatedCart = await Cart.findOne({ userId }).populate("items.productId");
    logger.info(`Item removed from cart for user ${userId}: product=${productId}`);
    res.status(200).json({ message: "Item removed from cart", cart: populatedCart.items });
  } catch (error) {
    logger.error(`Error removing from cart: ${error.message}, stack: ${error.stack}`);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

exports.clearCart = async (req, res) => {
  const userId = req.user._id;

  try {
    const cart = await Cart.findOne({ userId });
    if (!cart) {
      logger.info(`No cart found for user: ${userId}, returning empty cart`);
      return res.status(200).json({ message: "Cart cleared", cart: [] });
    }

    cart.items = [];
    await cart.save();
    logger.info(`Cart cleared for user: ${userId}`);
    res.status(200).json({ message: "Cart cleared", cart: cart.items });
  } catch (error) {
    logger.error(`Error clearing cart: ${error.message}, stack: ${error.stack}`);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};