const nodemailer = require('nodemailer');
const logger = require('./logger');

const transporter = nodemailer.createTransport({
  service: process.env.EMAIL_SERVICE,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

const sendEmail = async ({ to, subject, html }) => {
  try {
    const mailOptions = {
      from: `"GarBazar" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      html,
    };

    await transporter.sendMail(mailOptions);
    logger.info(`Email sent to ${to} at ${new Date().toISOString()}`);
  } catch (error) {
    logger.error(`Email sending failed at ${new Date().toISOString()}: ${error.message}`);
    throw new Error(`Failed to send email: ${error.message}`);
  }
};

const sendOrderConfirmationEmail = async (order, user) => {
  const itemsList = order.items
    .map(
      (item) =>
        `<li>${item.name || item.product.name} (x${item.quantity}) - Rs.${(item.price * item.quantity).toLocaleString()}</li>`
    )
    .join('');

  const isProMember = user.membership?.isPro || false;
  const proMessage = isProMember
    ? '<p>Thank you for being a Pro Member! Enjoy exclusive benefits on your next purchase.</p>'
    : '';

  const html = `
    <h2>Order Confirmation - GL Groceries</h2>
    <p>Dear ${user.name || 'Customer'},</p>
    <p>Thank you for your order! Your order #${order.orderNumber} has been successfully placed.</p>
    ${proMessage}
    <h3>Order Details</h3>
    <ul>${itemsList}</ul>
    <p><strong>Subtotal:</strong> Rs.${order.subtotal.toLocaleString()}</p>
    <p><strong>Delivery Charge:</strong> Rs.${order.deliveryCharge.toLocaleString()}</p>
    <p><strong>Total:</strong> Rs.${order.totalAmount.toLocaleString()}</p>
    <h3>Shipping Address</h3>
    <p>${order.shippingAddress.fullName}<br>
       ${order.shippingAddress.streetAddress}<br>
       ${order.shippingAddress.city}, ${order.shippingAddress.postalCode}<br>
       Phone: ${order.shippingAddress.phone}</p>
    <p><strong>Payment Method:</strong> ${order.paymentMethod === 'cod' ? 'Cash on Delivery' : 'Credit/Debit Card'}</p>
    <p>We’ll notify you when your order status changes. For any questions, contact us at support@glgroceries.com.</p>
  `;

  await sendEmail({
    to: user.email,
    subject: `Order Confirmation - #${order.orderNumber}`,
    html,
  });
};

const sendOrderUpdateEmail = async (order, user, newStatus) => {
  const isProMember = user.membership?.isPro || false;
  const proMessage = isProMember
    ? '<p>As a Pro Member, enjoy priority support and exclusive offers!</p>'
    : '';

  const html = `
    <h2>Order Update - GarBazar</h2>
    <p>Dear ${user.name || 'Customer'},</p>
    <p>Your order #${order.orderNumber} has been updated to <strong>${newStatus}</strong>.</p>
    ${proMessage}
    <h3>Order Details</h3>
    <ul>
      ${order.items
        .map(
          (item) =>
            `<li>${item.name || item.product.name} (x${item.quantity}) - Rs.${(item.price * item.quantity).toLocaleString()}</li>`
        )
        .join('')}
    </ul>
    <p><strong>Total:</strong> Rs.${order.totalAmount.toLocaleString()}</p>
    <p><strong>Shipping Address:</strong><br>
       ${order.shippingAddress.fullName}<br>
       ${order.shippingAddress.streetAddress}<br>
       ${order.shippingAddress.city}, ${order.shippingAddress.postalCode}</p>
    <p>For any questions, contact us at support@glgroceries.com.</p>
  `;

  await sendEmail({
    to: user.email,
    subject: `Order #${order.orderNumber} Status Update: ${newStatus}`,
    html,
  });
};

const sendPasswordResetEmail = async (user, resetToken) => {
  const resetUrl = `${process.env.FRONTEND_URL}/reset-password/${resetToken}`;
  const html = `
    <h2>Password Reset Request - GarBazar</h2>
    <p>Dear ${user.name || 'Customer'},</p>
    <p>You requested a password reset for your GarBazar account.</p>
    <p>Please click the link below to reset your password:</p>
    <a href="${resetUrl}">${resetUrl}</a>
    <p>This link will expire in 1 hour.</p>
    <p>If you did not request this, please ignore this email.</p>
    <p>Best regards,<br>GarBazar Team</p>
  `;

  await sendEmail({
    to: user.email,
    subject: 'Password Reset Request - GarBazar',
    html,
  });
};

module.exports = { sendOrderConfirmationEmail, sendOrderUpdateEmail, sendPasswordResetEmail };