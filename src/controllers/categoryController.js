const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const ApiResponse = require('../utils/ApiResponse');
const Category = require('../models/Category');
const { uploadBufferToCloudinary, deleteFromCloudinary } = require('../utils/cloudinaryUpload');

/**
 * POST /api/v1/stores/:storeId/categories
 */
const createCategory = asyncHandler(async (req, res) => {
  const { name, description, parent } = req.body;

  const category = await Category.create({
    store: req.targetStore._id,
    name,
    description: description || '',
    parent: parent || null,
  });

  return new ApiResponse(201, category, 'Category created').send(res);
});

/**
 * GET /api/v1/stores/:storeId/categories
 */
const listCategories = asyncHandler(async (req, res) => {
  const categories = await Category.find({ store: req.targetStore._id }).sort({ name: 1 });
  return new ApiResponse(200, categories).send(res);
});

/**
 * PATCH /api/v1/stores/:storeId/categories/:categoryId
 */
const updateCategory = asyncHandler(async (req, res) => {
  const category = await Category.findOne({
    _id: req.params.categoryId,
    store: req.targetStore._id,
  });
  if (!category) throw ApiError.notFound('Category not found');

  const allowed = ['name', 'description', 'parent', 'isActive'];
  for (const field of allowed) {
    if (req.body[field] !== undefined) category[field] = req.body[field];
  }

  await category.save();
  return new ApiResponse(200, category, 'Category updated').send(res);
});

/**
 * POST /api/v1/stores/:storeId/categories/:categoryId/image
 */
const updateCategoryImage = asyncHandler(async (req, res) => {
  const category = await Category.findOne({
    _id: req.params.categoryId,
    store: req.targetStore._id,
  });
  if (!category) throw ApiError.notFound('Category not found');
  if (!req.file) throw ApiError.badRequest('No file uploaded');

  if (category.image && category.image.publicId) {
    await deleteFromCloudinary(category.image.publicId);
  }

  const result = await uploadBufferToCloudinary(req.file.buffer, {
    folder: `stores/${req.targetStore.slug}/categories`,
  });

  category.image = result;
  await category.save();

  return new ApiResponse(200, category, 'Category image updated').send(res);
});

/**
 * DELETE /api/v1/stores/:storeId/categories/:categoryId
 */
const deleteCategory = asyncHandler(async (req, res) => {
  const Product = require('../models/Product');
  const inUse = await Product.exists({ category: req.params.categoryId, store: req.targetStore._id });
  if (inUse) {
    throw ApiError.conflict('Cannot delete a category that has products. Move or delete those products first.');
  }

  const category = await Category.findOneAndDelete({
    _id: req.params.categoryId,
    store: req.targetStore._id,
  });
  if (!category) throw ApiError.notFound('Category not found');

  if (category.image && category.image.publicId) {
    await deleteFromCloudinary(category.image.publicId);
  }

  return new ApiResponse(200, null, 'Category deleted').send(res);
});

module.exports = { createCategory, listCategories, updateCategory, updateCategoryImage, deleteCategory };
