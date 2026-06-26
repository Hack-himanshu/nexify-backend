const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const ApiResponse = require('../utils/ApiResponse');
const Product = require('../models/Product');
const Category = require('../models/Category');
const Brand = require('../models/Brand');
const { uploadBufferToCloudinary, deleteFromCloudinary } = require('../utils/cloudinaryUpload');

/**
 * Verifies a category (and brand, if given) actually belongs to this store —
 * prevents a store owner from accidentally (or maliciously) attaching another
 * store's category/brand to their product via a guessed ObjectId.
 */
const assertCategoryAndBrandBelongToStore = async (storeId, categoryId, brandId) => {
  const category = await Category.findOne({ _id: categoryId, store: storeId });
  if (!category) throw ApiError.badRequest('Category does not belong to this store');

  if (brandId) {
    const brand = await Brand.findOne({ _id: brandId, store: storeId });
    if (!brand) throw ApiError.badRequest('Brand does not belong to this store');
  }
};

/**
 * POST /api/v1/stores/:storeId/products
 */
const createProduct = asyncHandler(async (req, res) => {
  const storeId = req.targetStore._id;
  const {
    title,
    description,
    shortDescription,
    price,
    salePrice,
    sku,
    stock,
    category,
    brand,
    tags,
    trackInventory,
    allowBackorder,
    weight,
    seo,
  } = req.body;

  await assertCategoryAndBrandBelongToStore(storeId, category, brand);

  const product = await Product.create({
    store: storeId,
    title,
    description: description || '',
    shortDescription: shortDescription || '',
    price,
    salePrice: salePrice ?? null,
    sku,
    stock: stock ?? 0,
    category,
    brand: brand || null,
    tags: tags || [],
    trackInventory: trackInventory ?? true,
    allowBackorder: allowBackorder ?? false,
    weight,
    seo,
  });

  return new ApiResponse(201, product, 'Product created as draft').send(res);
});

/**
 * GET /api/v1/stores/:storeId/products
 * Supports filtering (category, brand, status, search) and pagination —
 * essential once a store has more than a handful of products.
 */
const listProducts = asyncHandler(async (req, res) => {
  const storeId = req.targetStore._id;
  const { category, brand, status, search, page = 1, limit = 20, sort = '-createdAt' } = req.query;

  const filter = { store: storeId };
  if (category) filter.category = category;
  if (brand) filter.brand = brand;
  if (status) filter.status = status;
  if (search) filter.$text = { $search: search };

  const skip = (Number(page) - 1) * Number(limit);
  const [products, total] = await Promise.all([
    Product.find(filter)
      .populate('category', 'name slug')
      .populate('brand', 'name')
      .sort(sort)
      .skip(skip)
      .limit(Number(limit)),
    Product.countDocuments(filter),
  ]);

  return new ApiResponse(200, products, 'Products fetched', {
    page: Number(page),
    limit: Number(limit),
    total,
    totalPages: Math.ceil(total / Number(limit)),
  }).send(res);
});

/**
 * GET /api/v1/stores/:storeId/products/:productId
 */
const getProductById = asyncHandler(async (req, res) => {
  const product = await Product.findOne({
    _id: req.params.productId,
    store: req.targetStore._id,
  })
    .populate('category', 'name slug')
    .populate('brand', 'name')
    .populate('relatedProducts', 'title slug images price salePrice');

  if (!product) throw ApiError.notFound('Product not found');
  return new ApiResponse(200, product).send(res);
});

/**
 * PATCH /api/v1/stores/:storeId/products/:productId
 */
const updateProduct = asyncHandler(async (req, res) => {
  const product = await Product.findOne({
    _id: req.params.productId,
    store: req.targetStore._id,
  });
  if (!product) throw ApiError.notFound('Product not found');

  if (req.body.category || req.body.brand) {
    await assertCategoryAndBrandBelongToStore(
      req.targetStore._id,
      req.body.category || product.category,
      req.body.brand !== undefined ? req.body.brand : product.brand
    );
  }

  const allowedFields = [
    'title',
    'description',
    'shortDescription',
    'price',
    'salePrice',
    'sku',
    'stock',
    'category',
    'brand',
    'tags',
    'trackInventory',
    'allowBackorder',
    'weight',
    'seo',
    'isFeatured',
    'relatedProducts',
  ];

  for (const field of allowedFields) {
    if (req.body[field] !== undefined) product[field] = req.body[field];
  }

  await product.save();
  return new ApiResponse(200, product, 'Product updated').send(res);
});

/**
 * PATCH /api/v1/stores/:storeId/products/:productId/status
 * body: { status: 'draft' | 'active' | 'archived' }
 */
const updateProductStatus = asyncHandler(async (req, res) => {
  const { status } = req.body;
  if (!['draft', 'active', 'archived'].includes(status)) {
    throw ApiError.badRequest('Invalid status. Must be draft, active, or archived.');
  }

  const product = await Product.findOne({
    _id: req.params.productId,
    store: req.targetStore._id,
  });
  if (!product) throw ApiError.notFound('Product not found');

  if (status === 'active') {
    if (!product.images || product.images.length === 0) {
      throw ApiError.badRequest('Add at least one product image before publishing');
    }
  }

  product.status = status;
  await product.save();

  return new ApiResponse(200, product, `Product ${status === 'active' ? 'published' : status}`).send(res);
});

/**
 * DELETE /api/v1/stores/:storeId/products/:productId
 */
const deleteProduct = asyncHandler(async (req, res) => {
  const product = await Product.findOneAndDelete({
    _id: req.params.productId,
    store: req.targetStore._id,
  });
  if (!product) throw ApiError.notFound('Product not found');

  // Clean up Cloudinary assets so we don't leak storage usage for a deleted product
  const allAssets = [...product.images, ...product.videos];
  await Promise.all(
    allAssets.map((asset) =>
      deleteFromCloudinary(asset.publicId, asset.url && asset.url.includes('/video/') ? 'video' : 'image')
    )
  );

  return new ApiResponse(200, null, 'Product deleted').send(res);
});

/**
 * POST /api/v1/stores/:storeId/products/:productId/images
 * multipart/form-data, field name "images" (multiple allowed)
 */
const uploadProductImages = asyncHandler(async (req, res) => {
  const product = await Product.findOne({
    _id: req.params.productId,
    store: req.targetStore._id,
  });
  if (!product) throw ApiError.notFound('Product not found');

  if (!req.files || req.files.length === 0) {
    throw ApiError.badRequest('No files uploaded');
  }

  const uploaded = await Promise.all(
    req.files.map((file) =>
      uploadBufferToCloudinary(file.buffer, {
        folder: `stores/${req.targetStore.slug}/products/${product.slug}`,
      })
    )
  );

  product.images.push(...uploaded.map((u) => ({ url: u.url, publicId: u.publicId, alt: product.title })));
  await product.save();

  return new ApiResponse(200, product.images, 'Images uploaded').send(res);
});

/**
 * DELETE /api/v1/stores/:storeId/products/:productId/images/:imagePublicIdEncoded
 * publicId is URL-encoded since Cloudinary public IDs contain slashes.
 */
const deleteProductImage = asyncHandler(async (req, res) => {
  const product = await Product.findOne({
    _id: req.params.productId,
    store: req.targetStore._id,
  });
  if (!product) throw ApiError.notFound('Product not found');

  const publicId = decodeURIComponent(req.params.imagePublicId);
  const imageIndex = product.images.findIndex((img) => img.publicId === publicId);
  if (imageIndex === -1) throw ApiError.notFound('Image not found on this product');

  product.images.splice(imageIndex, 1);
  await product.save();
  await deleteFromCloudinary(publicId);

  return new ApiResponse(200, product.images, 'Image removed').send(res);
});

/**
 * POST /api/v1/stores/:storeId/products/:productId/videos
 */
const uploadProductVideos = asyncHandler(async (req, res) => {
  const product = await Product.findOne({
    _id: req.params.productId,
    store: req.targetStore._id,
  });
  if (!product) throw ApiError.notFound('Product not found');

  if (!req.files || req.files.length === 0) {
    throw ApiError.badRequest('No files uploaded');
  }

  const uploaded = await Promise.all(
    req.files.map((file) =>
      uploadBufferToCloudinary(file.buffer, {
        folder: `stores/${req.targetStore.slug}/products/${product.slug}`,
        resourceType: 'video',
      })
    )
  );

  product.videos.push(...uploaded.map((u) => ({ url: u.url, publicId: u.publicId, alt: product.title })));
  await product.save();

  return new ApiResponse(200, product.videos, 'Videos uploaded').send(res);
});

/**
 * PUT /api/v1/stores/:storeId/products/:productId/variants
 * Replaces the full variant option/value matrix in one call — variant
 * editing in the dashboard UI is naturally a "save the whole grid" operation
 * (add/remove/edit rows together), so a full replace is simpler and safer
 * than trying to diff individual variant changes.
 */
const updateProductVariants = asyncHandler(async (req, res) => {
  const { variantOptions, variants } = req.body;

  const product = await Product.findOne({
    _id: req.params.productId,
    store: req.targetStore._id,
  });
  if (!product) throw ApiError.notFound('Product not found');

  // Ensure SKUs are unique within this product's variant set
  const skus = variants.map((v) => v.sku);
  if (new Set(skus).size !== skus.length) {
    throw ApiError.badRequest('Variant SKUs must be unique within a product');
  }

  product.hasVariants = true;
  product.variantOptions = variantOptions;
  product.variants = variants;
  await product.save();

  return new ApiResponse(200, product, 'Variants updated').send(res);
});

/**
 * PATCH /api/v1/stores/:storeId/products/:productId/inventory
 * Direct stock adjustment — for simple products: { stock: 50 }
 * for variant products: { variantId: '...', stock: 50 }
 */
const updateInventory = asyncHandler(async (req, res) => {
  const { stock, variantId } = req.body;
  if (typeof stock !== 'number' || stock < 0) {
    throw ApiError.badRequest('A valid non-negative stock number is required');
  }

  const product = await Product.findOne({
    _id: req.params.productId,
    store: req.targetStore._id,
  });
  if (!product) throw ApiError.notFound('Product not found');

  if (variantId) {
    const variant = product.variants.id(variantId);
    if (!variant) throw ApiError.notFound('Variant not found');
    variant.stock = stock;
  } else {
    product.stock = stock;
  }

  await product.save();
  return new ApiResponse(200, product, 'Inventory updated').send(res);
});

module.exports = {
  createProduct,
  listProducts,
  getProductById,
  updateProduct,
  updateProductStatus,
  deleteProduct,
  uploadProductImages,
  deleteProductImage,
  uploadProductVideos,
  updateProductVariants,
  updateInventory,
};
