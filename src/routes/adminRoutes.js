const express = require('express');
const storeController = require('../controllers/storeController');
const { protect, authorize } = require('../middleware/auth');
const { body } = require('express-validator');
const validate = require('../middleware/validate');

const router = express.Router();

// Every route here is Super Admin only
router.use(protect, authorize('super_admin'));

router.get('/stores', storeController.adminListStores);
router.patch('/stores/:storeId/approve', storeController.adminApproveStore);
router.patch(
  '/stores/:storeId/reject',
  [body('reason').optional().isString().isLength({ max: 500 })],
  validate,
  storeController.adminRejectStore
);
router.patch(
  '/stores/:storeId/suspend',
  [body('reason').optional().isString().isLength({ max: 500 })],
  validate,
  storeController.adminSuspendStore
);
router.patch('/stores/:storeId/reactivate', storeController.adminReactivateStore);

module.exports = router;
