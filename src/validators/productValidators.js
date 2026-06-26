const { body } = require('express-validator');

const createProductValidators = [
  body('title').trim().notEmpty().withMessage('Product title is required').isLength({ max: 200 }),
  body('description').optional().isString(),
  body('shortDescription').optional().isLength({ max: 300 }),
  body('price').isFloat({ min: 0 }).withMessage('Price must be a positive number'),
  body('salePrice').optional({ nullable: true }).isFloat({ min: 0 }),
  body('sku').trim().notEmpty().withMessage('SKU is required'),
  body('stock').optional().isInt({ min: 0 }),
  body('category').notEmpty().withMessage('Category is required').isMongoId(),
  body('brand').optional({ nullable: true }).isMongoId(),
  body('tags').optional().isArray(),
  body('hasVariants').optional().isBoolean(),
  body('trackInventory').optional().isBoolean(),
];

const updateProductValidators = [
  body('title').optional().trim().isLength({ min: 1, max: 200 }),
  body('price').optional().isFloat({ min: 0 }),
  body('salePrice').optional({ nullable: true }).isFloat({ min: 0 }),
  body('stock').optional().isInt({ min: 0 }),
  body('category').optional().isMongoId(),
  body('brand').optional({ nullable: true }).isMongoId(),
  body('tags').optional().isArray(),
];

const updateVariantsValidators = [
  body('variantOptions').isArray().withMessage('variantOptions must be an array'),
  body('variants').isArray({ min: 1 }).withMessage('At least one variant is required'),
  body('variants.*.sku').notEmpty().withMessage('Each variant needs a SKU'),
  body('variants.*.price').isFloat({ min: 0 }).withMessage('Each variant needs a valid price'),
  body('variants.*.stock').isInt({ min: 0 }).withMessage('Each variant needs a valid stock count'),
];

const categoryValidators = [
  body('name').trim().notEmpty().withMessage('Category name is required').isLength({ max: 100 }),
  body('description').optional().isLength({ max: 1000 }),
  body('parent').optional({ nullable: true }).isMongoId(),
];

const brandValidators = [
  body('name').trim().notEmpty().withMessage('Brand name is required').isLength({ max: 100 }),
  body('description').optional().isLength({ max: 1000 }),
];

module.exports = {
  createProductValidators,
  updateProductValidators,
  updateVariantsValidators,
  categoryValidators,
  brandValidators,
};
