const express = require('express');
const storeController = require('../controllers/storeController');
const { protect, authorize, requireStoreOwnership } = require('../middleware/auth');
const loadStore = require('../middleware/loadStore');
const validate = require('../middleware/validate');
const upload = require('../middleware/upload');
const {
  createStoreValidators,
  updateStoreSettingsValidators,
  updateStoreThemeValidators,
} = require('../validators/storeValidators');

const router = express.Router();

// All store-owner dashboard routes require authentication
router.use(protect);

// ---- Store Owner: create + list own stores ----
router.post(
  '/',
  authorize('store_owner'),
  createStoreValidators,
  validate,
  storeController.createStore
);
router.get('/mine', authorize('store_owner'), storeController.getMyStores);

// ---- Routes scoped to a specific store (owner or super_admin) ----
router.get(
  '/:storeId',
  loadStore,
  authorize('store_owner', 'super_admin'),
  requireStoreOwnership,
  storeController.getStoreById
);

router.patch(
  '/:storeId/settings',
  loadStore,
  authorize('store_owner', 'super_admin'),
  requireStoreOwnership,
  updateStoreSettingsValidators,
  validate,
  storeController.updateStoreSettings
);

router.patch(
  '/:storeId/theme',
  loadStore,
  authorize('store_owner', 'super_admin'),
  requireStoreOwnership,
  updateStoreThemeValidators,
  validate,
  storeController.updateStoreTheme
);

router.post(
  '/:storeId/logo',
  loadStore,
  authorize('store_owner', 'super_admin'),
  requireStoreOwnership,
  upload.single('logo'),
  storeController.updateStoreLogo
);

router.post(
  '/:storeId/favicon',
  loadStore,
  authorize('store_owner', 'super_admin'),
  requireStoreOwnership,
  upload.single('favicon'),
  storeController.updateStoreFavicon
);

router.post(
  '/:storeId/complete-onboarding',
  loadStore,
  authorize('store_owner', 'super_admin'),
  requireStoreOwnership,
  storeController.completeOnboarding
);

module.exports = router;
