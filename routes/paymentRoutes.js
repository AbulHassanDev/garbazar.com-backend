
const express = require('express');
const router = express.Router();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { createPaymentIntent, createMembershipPaymentIntent, confirmPayment } = require('../controllers/paymentController');
const { protect } = require('../middleware/auth');
const User = require('../models/User');
const Order = require('../models/Order');
const logger = require('../utils/logger');
const { sendOrderConfirmationEmail } = require('../utils/email');

router.post('/create-payment-intent', protect, createPaymentIntent);
router.post('/create-membership-payment-intent', protect, createMembershipPaymentIntent);
router.post('/confirm-payment', protect, confirmPayment);

router.post('/webhook', express.raw({ type: 'application/json' }), async (request, response) => {
  const sig = request.headers['stripe-signature'];

  let event;
  try {
    event = stripe.webhooks.constructEvent(
      request.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    logger.error(`Webhook signature verification failed at ${new Date().toISOString()}: ${err.message}`);
    return response.status(400).send(`Webhook Error: ${err.message}`);
  }

  switch (event.type) {
    case 'payment_intent.succeeded':
      const paymentIntent = event.data.object;
      logger.info(`PaymentIntent succeeded at ${new Date().toISOString()}: ${paymentIntent.id}`);

      if (paymentIntent.metadata.membershipType) {
        const userId = paymentIntent.metadata.userId;
        const membershipType = paymentIntent.metadata.membershipType;

        const user = await User.findById(userId);
        if (user) {
          const startDate = new Date();
          const endDate = new Date();
          endDate.setFullYear(startDate.getFullYear() + (membershipType === "annual" ? 1 : 0));
          endDate.setMonth(startDate.getMonth() + (membershipType === "monthly" ? 1 : 0));

          user.membership = {
            isPro: true,
            membershipType,
            paymentStatus: "Completed",
            orderRefNum: paymentIntent.id,
            startDate,
            endDate,
          };
          await user.save();
          logger.info(`Membership updated for user ${userId} at ${new Date().toISOString()}`);
        } else {
          logger.warn(`User not found for membership update at ${new Date().toISOString()}: ${userId}`);
        }
      } else {
        const order = await Order.findOne({ 'paymentDetails.intentId': paymentIntent.id }).populate("items.product", "name price");
        if (order) {
          // Only send email if order wasn't already processed
          if (order.paymentStatus !== 'Completed') {
            order.paymentStatus = 'Completed';
            order.status = 'Processing';
            order.paymentDetails = {
              ...order.paymentDetails,
              status: 'Completed',
              amount: paymentIntent.amount / 100,
              currency: paymentIntent.currency,
              timestamp: new Date(),
            };
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

            const user = await User.findById(order.user).select("name email membership");
            if (user) {
              try {
                await sendOrderConfirmationEmail(formattedOrder, user);
              } catch (emailError) {
                logger.error(`Failed to send webhook confirmation email for order ${order._id}: ${emailError.message}`);
              }
            } else {
              logger.warn(`User not found for email at ${new Date().toISOString()}: ${order.user}`);
            }

            logger.info(`Order ${order._id} updated to Completed via webhook at ${new Date().toISOString()}`);
          }
        }
      }
      break;

    case 'payment_intent.payment_failed':
      const failedPaymentIntent = event.data.object;
      logger.info(`PaymentIntent failed at ${new Date().toISOString()}: ${failedPaymentIntent.id}`);
      const failedOrder = await Order.findOne({ 'paymentDetails.intentId': failedPaymentIntent.id });
      if (failedOrder) {
        failedOrder.paymentStatus = 'Failed';
        failedOrder.paymentDetails.error = failedPaymentIntent.last_payment_error?.message;
        await failedOrder.save();
        logger.info(`Order ${failedOrder._id} updated to Failed via webhook at ${new Date().toISOString()}`);
      }
      break;

    default:
      logger.info(`Unhandled event type ${event.type} at ${new Date().toISOString()}`);
  }

  response.json({ received: true });
});

module.exports = router;