const { body } = require('express-validator');

const STORE_CATEGORIES = [
  'fashion',
  'electronics',
  'grocery',
  'furniture',
  'cosmetics',
  'jewelry',
  'books',
  'sports',
  'custom',
];

const createStoreValidators = [
  body('name').trim().notEmpty().withMessage('Store name is required').isLength({ max: 100 }),
  body('category')
    .trim()
    .notEmpty()
    .withMessage('Store category is required')
    .isIn(STORE_CATEGORIES)
    .withMessage('Invalid store category'),
  body('description').optional().isLength({ max: 1000 }),
  body('currency').optional().isLength({ min: 3, max: 3 }).withMessage('Use a 3-letter currency code (e.g. INR, USD)'),
];

const updateStoreSettingsValidators = [
  body('name').optional().trim().isLength({ min: 1, max: 100 }),
  body('description').optional().isLength({ max: 1000 }),
  body('currency').optional().isLength({ min: 3, max: 3 }),
  body('customDomain')
    .optional({ nullable: true })
    .trim()
    .matches(/^([a-z0-9-]+\.)+[a-z]{2,}$/i)
    .withMessage('Enter a valid domain (e.g. www.mybrand.com)'),
  body('contact.email').optional({ checkFalsy: true }).isEmail().withMessage('Invalid contact email'),
  body('tax.defaultRatePercent').optional().isFloat({ min: 0, max: 100 }),
  body('shipping.freeShippingThreshold').optional({ nullable: true }).isFloat({ min: 0 }),
  body('shipping.flatRate').optional().isFloat({ min: 0 }),
];

const updateStoreThemeValidators = [
  body('templateId').optional().isString(),
  body('colors.primary').optional().matches(/^#[0-9A-Fa-f]{6}$/).withMessage('Use a hex color, e.g. #111827'),
  body('colors.secondary').optional().matches(/^#[0-9A-Fa-f]{6}$/),
  body('colors.background').optional().matches(/^#[0-9A-Fa-f]{6}$/),
  body('colors.text').optional().matches(/^#[0-9A-Fa-f]{6}$/),
];

module.exports = {
  createStoreValidators,
  updateStoreSettingsValidators,
  updateStoreThemeValidators,
};
