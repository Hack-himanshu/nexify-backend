const mongoose = require('mongoose');

const planSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
    },
    description: {
      type: String,
      default: '',
    },
    priceMonthly: {
      type: Number,
      required: true,
      min: 0,
    },
    priceYearly: {
      type: Number,
      required: true,
      min: 0,
    },
    currency: {
      type: String,
      default: 'INR',
    },
    limits: {
      maxProducts: { type: Number, default: 50 },
      maxStaffAccounts: { type: Number, default: 1 },
      maxStorageMB: { type: Number, default: 500 },
      customDomainAllowed: { type: Boolean, default: false },
      abandonedCartRecovery: { type: Boolean, default: false },
      advancedAnalytics: { type: Boolean, default: false },
    },
    features: {
      type: [String],
      default: [],
    },
    transactionFeePercent: {
      type: Number,
      default: 2,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    isDefault: {
      type: Boolean,
      default: false,
    },
    trialDays: {
      type: Number,
      default: 14,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Plan', planSchema);
