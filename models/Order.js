
const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
  orderNumber: { 
    type: String, 
    required: true, 
    unique: true,
    default: function() {
      return `ORD-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    }
  },
  user: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  items: [
    {
      product: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Product', 
        required: true 
      },
      quantity: { 
        type: Number, 
        required: true 
      },
      price: { 
        type: Number, 
        required: true 
      },
      name: {  // Product name for better order display
        type: String,
        required: true
      }
    },
  ],
  subtotal: {  // Subtotal for order breakdown
    type: Number,
    required: true
  },
  deliveryCharge: {
    type: Number,
    required: true,
    default: 199
  },
  totalAmount: { 
    type: Number, 
    required: true 
  },
  status: {
    type: String,
    enum: ['Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled'],
    default: 'Pending',
  },
  paymentStatus: {
    type: String,
    enum: ['Pending', 'Completed', 'Failed', 'Refunded'],
    default: 'Pending',
  },
  paymentMethod: {
    type: String,
    enum: ['stripe', 'cod'], // Updated to match frontend (removed 'card')
    required: true,
  },
  paymentDetails: {
    transactionId: String,
    status: String,
    method: String,
    amount: Number,
    currency: String,
    timestamp: Date,
    error: String
  },
  shippingAddress: { 
    type: {
      fullName: { type: String, required: true },
      streetAddress: { type: String, required: true },
      city: { type: String, required: true },
      postalCode: { type: String, required: true },
      phone: { type: String, required: true },
      email: { type: String, required: true }
    },
    required: true 
  },
  createdAt: { 
    type: Date, 
    default: Date.now 
  },
  updatedAt: { 
    type: Date, 
    default: Date.now 
  },
});

orderSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('Order', orderSchema);