const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const Store = require('../models/Store');

/**
 * Resolves the tenant (Store) for the current request and attaches it as req.store.
 *
 * Resolution order:
 *   1. Custom domain (e.g. www.mybrand.com) - matched against Store.customDomain
 *   2. Subdomain (e.g. store1.platform.com) - matched against Store.slug
 *   3. X-Store-Slug header - used by the builder dashboard / local dev / mobile clients
 *      where the storefront isn't served from a real subdomain
 *
 * This middleware is for STOREFRONT / CUSTOMER-facing routes (product browsing,
 * cart, checkout). Store-owner dashboard routes instead resolve the store from
 * req.params.storeId + ownership check (see requireStoreOwnership in auth.js).
 */
const resolveTenant = asyncHandler(async (req, res, next) => {
  const platformDomain = process.env.PLATFORM_DOMAIN || 'platform.com';
  const host = (req.headers['x-forwarded-host'] || req.hostname || '').toLowerCase();
  const headerSlug = req.headers['x-store-slug'];

  let store = null;

  if (host && !host.endsWith(platformDomain) && host !== 'localhost') {
    // Looks like a custom domain (not our own platform domain)
    store = await Store.findOne({ customDomain: host }).populate('plan');
  } else if (host && host.endsWith(`.${platformDomain}`)) {
    const slug = host.replace(`.${platformDomain}`, '');
    if (slug && slug !== 'www') {
      store = await Store.findOne({ slug }).populate('plan');
    }
  }

  if (!store && headerSlug) {
    store = await Store.findOne({ slug: headerSlug }).populate('plan');
  }

  if (!store) {
    throw ApiError.notFound('Store not found for this domain');
  }

  if (store.status === 'suspended') {
    throw ApiError.forbidden('This store is currently unavailable');
  }
  if (store.status === 'pending_approval' || store.status === 'rejected') {
    throw ApiError.notFound('Store not found');
  }

  req.store = store;
  next();
});

/**
 * Same resolution logic as resolveTenant, but does NOT throw when no store is
 * found — it simply leaves req.store undefined. Used on shared auth routes
 * (register/login/forgot-password) that serve BOTH platform-level accounts
 * (store_owner, super_admin — no tenant context) and store-scoped customer
 * accounts (tenant context present via subdomain or X-Store-Slug header).
 */
const tryResolveTenant = asyncHandler(async (req, res, next) => {
  const platformDomain = process.env.PLATFORM_DOMAIN || 'platform.com';
  const host = (req.headers['x-forwarded-host'] || req.hostname || '').toLowerCase();
  const headerSlug = req.headers['x-store-slug'];

  let store = null;

  if (host && !host.endsWith(platformDomain) && host !== 'localhost') {
    store = await Store.findOne({ customDomain: host, status: 'active' }).populate('plan');
  } else if (host && host.endsWith(`.${platformDomain}`)) {
    const slug = host.replace(`.${platformDomain}`, '');
    if (slug && slug !== 'www') {
      store = await Store.findOne({ slug, status: 'active' }).populate('plan');
    }
  }

  if (!store && headerSlug) {
    store = await Store.findOne({ slug: headerSlug, status: 'active' }).populate('plan');
  }

  if (store) req.store = store;
  next();
});

module.exports = resolveTenant;
module.exports.resolveTenant = resolveTenant;
module.exports.tryResolveTenant = tryResolveTenant;
