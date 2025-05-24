const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
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
});

module.exports = mongoose.model("User", userSchema);
