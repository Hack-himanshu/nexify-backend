const express = require('express');
const productController = require('../controllers/productController');
const { protect, authorize, requireStoreOwnership } = require('../middleware/auth');
const loadStore = require('../middleware/loadStore');
const validate = require('../middleware/validate');
const upload = require('../middleware/upload');
const {
  createProductValidators,
  updateProductValidators,
  updateVariantsValidators,
} = require('../validators/productValidators');

// mergeParams so we can read :storeId from the parent mount path
const router = express.Router({ mergeParams: true });

router.use(protect, loadStore, authorize('store_owner', 'super_admin'), requireStoreOwnership);

router.post('/', createProductValidators, validate, productController.createProduct);
router.get('/', productController.listProducts);
router.get('/:productId', productController.getProductById);
router.patch('/:productId', updateProductValidators, validate, productController.updateProduct);
router.delete('/:productId', productController.deleteProduct);

router.patch('/:productId/status', productController.updateProductStatus);
router.patch('/:productId/inventory', productController.updateInventory);

router.put(
  '/:productId/variants',
  updateVariantsValidators,
  validate,
  productController.updateProductVariants
);

router.post('/:productId/images', upload.array('images', 10), productController.uploadProductImages);
router.delete('/:productId/images/:imagePublicId', productController.deleteProductImage);
router.post('/:productId/videos', upload.array('videos', 3), productController.uploadProductVideos);

module.exports = router;
