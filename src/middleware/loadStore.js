const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const Store = require('../models/Store');

/**
 * Loads the Store referenced by req.params.storeId and attaches it as
 * req.targetStore. Used on STORE-OWNER DASHBOARD routes (settings, theme,
 * products, etc.) where the store is identified by an explicit :storeId
 * route param rather than by subdomain (that's what tenantResolver is for,
 * on storefront/customer-facing routes instead).
 *
 * Must run BEFORE requireStoreOwnership so the ownership check has a store
 * to check against.
 */
const loadStore = asyncHandler(async (req, res, next) => {
  const { storeId } = req.params;
  if (!storeId) throw ApiError.badRequest('Store ID is required');

  const store = await Store.findById(storeId).populate('plan');
  if (!store) throw ApiError.notFound('Store not found');

  req.targetStore = store;
  next();
});

module.exports = loadStore;
