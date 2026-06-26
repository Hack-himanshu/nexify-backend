const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema(
  {
    store: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Store',
      required: true,
      index: true,
    },
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
      index: true,
    },
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
    },
    title: {
      type: String,
      maxlength: 150,
      default: '',
    },
    comment: {
      type: String,
      maxlength: 2000,
      default: '',
    },
    images: {
      type: [{ url: String, publicId: String }],
      default: [],
    },
    isVerifiedPurchase: {
      type: Boolean,
      default: false,
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'approved',
    },
  },
  { timestamps: true }
);

// One review per customer per product.
reviewSchema.index({ product: 1, customer: 1 }, { unique: true });

/**
 * Recalculates and persists the parent product's aggregate rating after any
 * review is created, updated, or removed. Using a static + post hooks keeps
 * the Product.ratings field denormalized-but-correct without the storefront
 * having to aggregate reviews on every product page load.
 */
reviewSchema.statics.recalculateProductRatings = async function (productId) {
  const Product = mongoose.model('Product');
  const stats = await this.aggregate([
    { $match: { product: productId, status: 'approved' } },
    {
      $group: {
        _id: '$product',
        average: { $avg: '$rating' },
        count: { $sum: 1 },
      },
    },
  ]);

  const ratings = stats.length
    ? { average: Math.round(stats[0].average * 10) / 10, count: stats[0].count }
    : { average: 0, count: 0 };

  await Product.findByIdAndUpdate(productId, { ratings });
};

reviewSchema.post('save', function () {
  this.constructor.recalculateProductRatings(this.product);
});

reviewSchema.post('findOneAndDelete', function (doc) {
  if (doc) doc.constructor.recalculateProductRatings(doc.product);
});

module.exports = mongoose.model('Review', reviewSchema);
