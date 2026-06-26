const mongoose = require('mongoose');
const slugify = require('slugify');

const mediaSchema = new mongoose.Schema(
  {
    url: { type: String, required: true },
    publicId: { type: String, required: true },
    alt: { type: String, default: '' },
  },
  { _id: false }
);

/**
 * Variant option definitions, e.g. { name: 'Size', values: ['S', 'M', 'L'] }.
 * Stored on the product so the storefront UI knows which selectors to render.
 */
const variantOptionSchema = new mongoose.Schema(
  {
    name: { type: String, required: true }, // e.g. "Size", "Color"
    values: { type: [String], required: true },
  },
  { _id: false }
);

/**
 * A single purchasable combination, e.g. { Size: 'M', Color: 'Red' }.
 * Each variant carries its own SKU/price/stock so inventory is tracked at the
 * combination level, not just the product level — required for real apparel/
 * electronics stores with size/color matrices.
 */
const variantSchema = new mongoose.Schema(
  {
    optionValues: {
      type: Map,
      of: String,
      required: true,
    },
    sku: {
      type: String,
      required: true,
    },
    price: {
      type: Number,
      required: true,
      min: 0,
    },
    salePrice: {
      type: Number,
      min: 0,
      default: null,
    },
    stock: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    image: mediaSchema,
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { _id: true }
);

const productSchema = new mongoose.Schema(
  {
    store: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Store',
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: [true, 'Product title is required'],
      trim: true,
      maxlength: 200,
    },
    slug: {
      type: String,
      required: true,
      lowercase: true,
    },
    description: {
      // Rich text HTML from the dashboard's WYSIWYG editor. Sanitized on write
      // in the controller before persisting (see productController).
      type: String,
      default: '',
    },
    shortDescription: {
      type: String,
      maxlength: 300,
      default: '',
    },
    images: {
      type: [mediaSchema],
      default: [],
    },
    videos: {
      type: [mediaSchema],
      default: [],
    },

    // Base price/sku/stock used for simple products (no variants).
    // When `hasVariants` is true, pricing/stock are read from `variants` instead
    // and these base fields are ignored by the storefront (kept for fallback display).
    price: {
      type: Number,
      required: true,
      min: 0,
    },
    salePrice: {
      type: Number,
      min: 0,
      default: null,
      validate: {
        validator: function (value) {
          return value == null || value <= this.price;
        },
        message: 'Sale price cannot exceed the regular price',
      },
    },
    sku: {
      type: String,
      required: true,
    },
    stock: {
      type: Number,
      min: 0,
      default: 0,
    },
    trackInventory: {
      type: Boolean,
      default: true,
    },
    allowBackorder: {
      type: Boolean,
      default: false,
    },

    hasVariants: {
      type: Boolean,
      default: false,
    },
    variantOptions: {
      type: [variantOptionSchema],
      default: [],
    },
    variants: {
      type: [variantSchema],
      default: [],
    },

    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      required: true,
      index: true,
    },
    brand: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Brand',
      default: null,
    },
    tags: {
      type: [String],
      default: [],
      index: true,
    },

    relatedProducts: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product',
      },
    ],

    ratings: {
      average: { type: Number, default: 0, min: 0, max: 5 },
      count: { type: Number, default: 0 },
    },

    weight: {
      value: { type: Number, default: 0 },
      unit: { type: String, enum: ['kg', 'g', 'lb'], default: 'kg' },
    },

    seo: {
      metaTitle: { type: String, default: '' },
      metaDescription: { type: String, default: '' },
    },

    status: {
      type: String,
      enum: ['draft', 'active', 'archived'],
      default: 'draft',
      index: true,
    },

    isFeatured: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

// Slug and SKU must be unique within a store, not globally — different stores
// can both sell a product called "Classic T-Shirt" with SKU "TS-001".
productSchema.index({ store: 1, slug: 1 }, { unique: true });
productSchema.index({ store: 1, sku: 1 }, { unique: true });
productSchema.index({ store: 1, status: 1, category: 1 });
productSchema.index({ title: 'text', shortDescription: 'text', tags: 'text' });

productSchema.pre('validate', function generateSlug(next) {
  if (this.title && (!this.slug || this.isModified('title'))) {
    this.slug = slugify(this.title, { lower: true, strict: true });
  }
  next();
});

/**
 * Returns the effective sellable price (sale price if set, else regular price).
 * Used consistently across cart/order calculations to avoid duplicating this
 * logic in multiple places.
 */
productSchema.methods.getEffectivePrice = function getEffectivePrice(variantId = null) {
  if (this.hasVariants && variantId) {
    const variant = this.variants.id(variantId);
    if (!variant) return null;
    return variant.salePrice ?? variant.price;
  }
  return this.salePrice ?? this.price;
};

productSchema.methods.getAvailableStock = function getAvailableStock(variantId = null) {
  if (this.hasVariants && variantId) {
    const variant = this.variants.id(variantId);
    return variant ? variant.stock : 0;
  }
  return this.stock;
};

module.exports = mongoose.model('Product', productSchema);
