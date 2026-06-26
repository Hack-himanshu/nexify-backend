const crypto = require('crypto');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const ApiResponse = require('../utils/ApiResponse');
const User = require('../models/User');
const {
  generateAccessToken,
  generateRefreshToken,
  rotateRefreshToken,
  revokeRefreshToken,
  revokeAllUserTokens,
} = require('../utils/tokenService');
const { sendPasswordResetEmail, sendWelcomeEmail } = require('../services/emailService');

const REFRESH_COOKIE_NAME = 'refreshToken';
const ACCESS_COOKIE_NAME = 'accessToken';

const cookieOptions = (maxAgeMs) => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
  maxAge: maxAgeMs,
  path: '/',
});

const setAuthCookies = async (res, user, meta) => {
  const accessToken = generateAccessToken(user);
  const refreshToken = await generateRefreshToken(user, meta);

  res.cookie(ACCESS_COOKIE_NAME, accessToken, cookieOptions(15 * 60 * 1000));
  res.cookie(REFRESH_COOKIE_NAME, refreshToken, cookieOptions(30 * 24 * 60 * 60 * 1000));

  return { accessToken, refreshToken };
};

/**
 * POST /api/v1/auth/register
 * Registers a store_owner (platform-level) or a customer (store-scoped, requires
 * X-Store-Slug header / req.store resolved by tenantResolver upstream on storefront routes).
 * super_admin accounts are never created through this endpoint — they're seeded directly.
 */
const register = asyncHandler(async (req, res) => {
  const { name, email, password, role } = req.body;
  const requestedRole = role === 'store_owner' ? 'store_owner' : 'customer';

  const storeId = requestedRole === 'customer' && req.store ? req.store._id : null;
  if (requestedRole === 'customer' && !storeId) {
    throw ApiError.badRequest('Store context is required to register as a customer');
  }

  const existing = await User.findOne({ email, store: storeId });
  if (existing) {
    throw ApiError.conflict('An account with this email already exists');
  }

  const user = await User.create({
    name,
    email,
    password,
    role: requestedRole,
    store: storeId,
  });

  const meta = { userAgent: req.headers['user-agent'], ip: req.ip };
  await setAuthCookies(res, user, meta);

  sendWelcomeEmail(user.email, user.name).catch(() => {});

  return new ApiResponse(201, user.toSafeObject(), 'Account created successfully').send(res);
});

/**
 * POST /api/v1/auth/login
 */
const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const storeId = req.store ? req.store._id : null;

  const user = await User.findOne({ email, store: storeId }).select('+password');
  if (!user || !(await user.comparePassword(password))) {
    throw ApiError.unauthorized('Invalid email or password');
  }
  if (!user.isActive) {
    throw ApiError.forbidden('This account has been deactivated');
  }

  user.lastLoginAt = new Date();
  await user.save();

  const meta = { userAgent: req.headers['user-agent'], ip: req.ip };
  await setAuthCookies(res, user, meta);

  return new ApiResponse(200, user.toSafeObject(), 'Logged in successfully').send(res);
});

/**
 * POST /api/v1/auth/refresh
 * Rotates the refresh token and issues a new access token. Frontend Axios
 * interceptor calls this automatically on a 401 from an expired access token.
 */
const refresh = asyncHandler(async (req, res) => {
  const rawToken = req.cookies?.[REFRESH_COOKIE_NAME];
  if (!rawToken) throw ApiError.unauthorized('No refresh token provided');

  const meta = { userAgent: req.headers['user-agent'], ip: req.ip };
  const rotated = await rotateRefreshToken(rawToken, meta);

  if (!rotated) {
    res.clearCookie(ACCESS_COOKIE_NAME, cookieOptions(0));
    res.clearCookie(REFRESH_COOKIE_NAME, cookieOptions(0));
    throw ApiError.unauthorized('Session expired, please log in again');
  }

  const user = await User.findById(rotated.userId);
  if (!user || !user.isActive) {
    throw ApiError.unauthorized('Account no longer active');
  }

  const accessToken = generateAccessToken(user);
  res.cookie(ACCESS_COOKIE_NAME, accessToken, cookieOptions(15 * 60 * 1000));
  res.cookie(REFRESH_COOKIE_NAME, rotated.rawToken, cookieOptions(30 * 24 * 60 * 60 * 1000));

  return new ApiResponse(200, { accessToken }, 'Token refreshed').send(res);
});

/**
 * POST /api/v1/auth/logout
 */
const logout = asyncHandler(async (req, res) => {
  const rawToken = req.cookies?.[REFRESH_COOKIE_NAME];
  if (rawToken) await revokeRefreshToken(rawToken);

  res.clearCookie(ACCESS_COOKIE_NAME, cookieOptions(0));
  res.clearCookie(REFRESH_COOKIE_NAME, cookieOptions(0));

  return new ApiResponse(200, null, 'Logged out successfully').send(res);
});

/**
 * POST /api/v1/auth/logout-all
 * Revokes every active session for the user (e.g. "log out of all devices").
 */
const logoutAll = asyncHandler(async (req, res) => {
  await revokeAllUserTokens(req.user._id);
  res.clearCookie(ACCESS_COOKIE_NAME, cookieOptions(0));
  res.clearCookie(REFRESH_COOKIE_NAME, cookieOptions(0));
  return new ApiResponse(200, null, 'Logged out of all devices').send(res);
});

/**
 * GET /api/v1/auth/me
 */
const getMe = asyncHandler(async (req, res) => {
  return new ApiResponse(200, req.user.toSafeObject()).send(res);
});

/**
 * POST /api/v1/auth/forgot-password
 * Always returns a generic success message regardless of whether the email
 * exists, to avoid leaking account existence (user enumeration).
 */
const forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body;
  const storeId = req.store ? req.store._id : null;
  const user = await User.findOne({ email, store: storeId });

  if (user) {
    const rawToken = crypto.randomBytes(32).toString('hex');
    user.passwordResetToken = crypto.createHash('sha256').update(rawToken).digest('hex');
    user.passwordResetExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
    await user.save();

    const baseUrl = req.store
      ? `https://${req.store.slug}.${process.env.PLATFORM_DOMAIN}`
      : process.env.CLIENT_URL;
    const resetUrl = `${baseUrl}/reset-password?token=${rawToken}`;

    sendPasswordResetEmail(user.email, resetUrl).catch(() => {});
  }

  return new ApiResponse(
    200,
    null,
    'If an account with that email exists, a reset link has been sent'
  ).send(res);
});

/**
 * POST /api/v1/auth/reset-password
 */
const resetPassword = asyncHandler(async (req, res) => {
  const { token, password } = req.body;
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

  const user = await User.findOne({
    passwordResetToken: tokenHash,
    passwordResetExpires: { $gt: new Date() },
  }).select('+passwordResetToken +passwordResetExpires');

  if (!user) {
    throw ApiError.badRequest('Password reset token is invalid or has expired');
  }

  user.password = password;
  user.passwordResetToken = undefined;
  user.passwordResetExpires = undefined;
  await user.save();

  await revokeAllUserTokens(user._id); // force re-login everywhere after a reset

  return new ApiResponse(200, null, 'Password reset successfully. Please log in.').send(res);
});

/**
 * PATCH /api/v1/auth/change-password
 */
const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const user = await User.findById(req.user._id).select('+password');

  if (!(await user.comparePassword(currentPassword))) {
    throw ApiError.badRequest('Current password is incorrect');
  }

  user.password = newPassword;
  await user.save();
  await revokeAllUserTokens(user._id);

  return new ApiResponse(200, null, 'Password changed successfully. Please log in again.').send(
    res
  );
});

/**
 * GET /api/v1/auth/google/callback
 * Called after passport.authenticate('google') populates req.user via the strategy.
 */
const googleCallback = asyncHandler(async (req, res) => {
  const user = req.user;
  const meta = { userAgent: req.headers['user-agent'], ip: req.ip };
  await setAuthCookies(res, user, meta);

  const redirectBase = user.store
    ? `https://${req.query.storeSlug || ''}.${process.env.PLATFORM_DOMAIN}`
    : process.env.CLIENT_URL;

  res.redirect(`${redirectBase}/auth/oauth-success`);
});

module.exports = {
  register,
  login,
  refresh,
  logout,
  logoutAll,
  getMe,
  forgotPassword,
  resetPassword,
  changePassword,
  googleCallback,
};
