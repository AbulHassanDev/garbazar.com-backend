
const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
    },
    password: {
      type: String,
      required: true,
    },
    phone: {
      type: String,
      required: true,
    },
    type: {
      type: String,
      enum: ["normal", "pro", "admin"],
      default: "normal",
    },
    membership: {
      isPro: { type: Boolean, default: false },
      membershipType: { type: String, enum: ["monthly", "annual", null], default: null },
      paymentStatus: { type: String, enum: ["pending", "completed", "failed", null], default: null },
      orderRefNum: { type: String, default: null },
      startDate: { type: Date, default: null },
      endDate: { type: Date, default: null },
    },
    resetPasswordToken: {
      type: String,
      default: null,
    },
    resetPasswordExpires: {
      type: Date,
      default: null,
    },
    cart: [
      {
        productId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Product", // Reference to the Product model
          required: true,
        },
        quantity: {
          type: Number,
          required: true,
          min: 1,
        },
        _id: false, // Optional: Prevents Mongoose from generating _id for each cart item
      },
    ],
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", userSchema);
