const jwt = require('jsonwebtoken');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const User = require('../models/User');

/**
 * Verifies the access token (from Authorization header or cookie) and attaches
 * the authenticated user to req.user. Does NOT hit the DB on every request for
 * the token's claims — only fetches the user when we need fresh state
 * (e.g. to check isActive), trading one DB read for correctness.
 */
const protect = asyncHandler(async (req, res, next) => {
  let token;

  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  } else if (req.cookies && req.cookies.accessToken) {
    token = req.cookies.accessToken;
  }

  if (!token) {
    throw ApiError.unauthorized('Authentication required');
  }

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
  } catch (err) {
    throw ApiError.unauthorized('Invalid or expired token');
  }

  const user = await User.findById(decoded.sub);
  if (!user || !user.isActive) {
    throw ApiError.unauthorized('User account is no longer active');
  }

  req.user = user;
  req.tokenStoreId = decoded.store || null;
  next();
});

/**
 * Restricts a route to one or more roles. Use after `protect`.
 * Example: router.get('/admin', protect, authorize('super_admin'), handler)
 */
const authorize = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return next(ApiError.unauthorized('Authentication required'));
    }
    if (!allowedRoles.includes(req.user.role)) {
      return next(ApiError.forbidden('You do not have permission to perform this action'));
    }
    next();
  };
};

/**
 * Ensures a store_owner can only act on stores they actually own.
 * Expects the target store to already be resolved as req.targetStore (see
 * loadStore middleware) or available via req.store / req.params.storeId.
 * Super admins bypass this check.
 */
const requireStoreOwnership = asyncHandler(async (req, res, next) => {
  if (req.user.role === 'super_admin') return next();

  const storeId =
    (req.targetStore && req.targetStore._id.toString()) ||
    (req.store && req.store._id.toString()) ||
    req.params.storeId;
  if (!storeId) throw ApiError.badRequest('Store context is required');

  const isOwner = req.user.ownedStores && req.user.ownedStores.some(
    (id) => id.toString() === storeId
  );
  if (!isOwner) {
    throw ApiError.forbidden('You do not own this store');
  }
  next();
});

/**
 * Optional auth: attaches req.user if a valid token is present, but does not
 * reject the request if absent. Useful for storefront routes that behave
 * differently for logged-in vs guest customers.
 */
const optionalAuth = asyncHandler(async (req, res, next) => {
  const authHeader = req.headers.authorization;
  let token;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  } else if (req.cookies && req.cookies.accessToken) {
    token = req.cookies.accessToken;
  }

  if (!token) return next();

  try {
    const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
    const user = await User.findById(decoded.sub);
    if (user && user.isActive) req.user = user;
  } catch (err) {
    // silently ignore — this route doesn't require auth
  }
  next();
});

module.exports = { protect, authorize, requireStoreOwnership, optionalAuth };
