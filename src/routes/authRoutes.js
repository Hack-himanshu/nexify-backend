const express = require('express');
const passport = require('passport');
const authController = require('../controllers/authController');
const { protect } = require('../middleware/auth');
const { authLimiter } = require('../middleware/rateLimiter');
const validate = require('../middleware/validate');
const { tryResolveTenant } = require('../middleware/tenantResolver');
const {
  registerValidators,
  loginValidators,
  forgotPasswordValidators,
  resetPasswordValidators,
  changePasswordValidators,
} = require('../validators/authValidators');

const router = express.Router();

/**
 * Tenant resolution note:
 * - store_owner register/login: platform-level, no tenant resolution needed.
 * - customer register/login: tenant-scoped. In production the storefront is
 *   served from store1.platform.com, so tryResolveTenant reads the Host header
 *   automatically and attaches req.store. For store_owner requests (no store
 *   subdomain / no X-Store-Slug header) it simply leaves req.store undefined
 *   instead of throwing — unlike the strict resolveTenant used on storefront
 *   browsing routes (products, cart, checkout).
 */
router.use(tryResolveTenant);

router.post('/register', authLimiter, registerValidators, validate, authController.register);
router.post('/login', authLimiter, loginValidators, validate, authController.login);
router.post('/refresh', authController.refresh);
router.post('/logout', authController.logout);
router.post('/logout-all', protect, authController.logoutAll);
router.get('/me', protect, authController.getMe);

router.post(
  '/forgot-password',
  authLimiter,
  forgotPasswordValidators,
  validate,
  authController.forgotPassword
);
router.post(
  '/reset-password',
  authLimiter,
  resetPasswordValidators,
  validate,
  authController.resetPassword
);
router.patch(
  '/change-password',
  protect,
  changePasswordValidators,
  validate,
  authController.changePassword
);

// Google OAuth
router.get('/google', (req, res, next) => {
  const state = req.query.storeSlug ? JSON.stringify({ storeSlug: req.query.storeSlug }) : '';
  passport.authenticate('google', { scope: ['profile', 'email'], session: false, state })(
    req,
    res,
    next
  );
});

router.get(
  '/google/callback',
  passport.authenticate('google', { session: false, failureRedirect: '/login?error=oauth' }),
  authController.googleCallback
);

module.exports = router;
