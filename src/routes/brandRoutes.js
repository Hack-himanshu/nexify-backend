const express = require('express');
const brandController = require('../controllers/brandController');
const { protect, authorize, requireStoreOwnership } = require('../middleware/auth');
const loadStore = require('../middleware/loadStore');
const validate = require('../middleware/validate');
const upload = require('../middleware/upload');
const { brandValidators } = require('../validators/productValidators');

const router = express.Router({ mergeParams: true });

router.use(protect, loadStore, authorize('store_owner', 'super_admin'), requireStoreOwnership);

router.post('/', brandValidators, validate, brandController.createBrand);
router.get('/', brandController.listBrands);
router.patch('/:brandId', brandController.updateBrand);
router.post('/:brandId/logo', upload.single('logo'), brandController.updateBrandLogo);
router.delete('/:brandId', brandController.deleteBrand);

module.exports = router;
