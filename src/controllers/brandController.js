const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const ApiResponse = require('../utils/ApiResponse');
const Brand = require('../models/Brand');
const { uploadBufferToCloudinary, deleteFromCloudinary } = require('../utils/cloudinaryUpload');

const createBrand = asyncHandler(async (req, res) => {
  const { name, description } = req.body;

  const brand = await Brand.create({
    store: req.targetStore._id,
    name,
    description: description || '',
  });

  return new ApiResponse(201, brand, 'Brand created').send(res);
});

const listBrands = asyncHandler(async (req, res) => {
  const brands = await Brand.find({ store: req.targetStore._id }).sort({ name: 1 });
  return new ApiResponse(200, brands).send(res);
});

const updateBrand = asyncHandler(async (req, res) => {
  const brand = await Brand.findOne({ _id: req.params.brandId, store: req.targetStore._id });
  if (!brand) throw ApiError.notFound('Brand not found');

  const allowed = ['name', 'description', 'isActive'];
  for (const field of allowed) {
    if (req.body[field] !== undefined) brand[field] = req.body[field];
  }

  await brand.save();
  return new ApiResponse(200, brand, 'Brand updated').send(res);
});

const updateBrandLogo = asyncHandler(async (req, res) => {
  const brand = await Brand.findOne({ _id: req.params.brandId, store: req.targetStore._id });
  if (!brand) throw ApiError.notFound('Brand not found');
  if (!req.file) throw ApiError.badRequest('No file uploaded');

  if (brand.logo && brand.logo.publicId) {
    await deleteFromCloudinary(brand.logo.publicId);
  }

  const result = await uploadBufferToCloudinary(req.file.buffer, {
    folder: `stores/${req.targetStore.slug}/brands`,
  });

  brand.logo = result;
  await brand.save();

  return new ApiResponse(200, brand, 'Brand logo updated').send(res);
});

const deleteBrand = asyncHandler(async (req, res) => {
  const Product = require('../models/Product');
  const inUse = await Product.exists({ brand: req.params.brandId, store: req.targetStore._id });
  if (inUse) {
    throw ApiError.conflict('Cannot delete a brand that has products. Move or delete those products first.');
  }

  const brand = await Brand.findOneAndDelete({ _id: req.params.brandId, store: req.targetStore._id });
  if (!brand) throw ApiError.notFound('Brand not found');

  if (brand.logo && brand.logo.publicId) {
    await deleteFromCloudinary(brand.logo.publicId);
  }

  return new ApiResponse(200, null, 'Brand deleted').send(res);
});

module.exports = { createBrand, listBrands, updateBrand, updateBrandLogo, deleteBrand };
