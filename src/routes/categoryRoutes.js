const express = require('express');
const categoryController = require('../controllers/categoryController');
const { protect, authorize, requireStoreOwnership } = require('../middleware/auth');
const loadStore = require('../middleware/loadStore');
const validate = require('../middleware/validate');
const upload = require('../middleware/upload');
const { categoryValidators } = require('../validators/productValidators');

const router = express.Router({ mergeParams: true });

router.use(protect, loadStore, authorize('store_owner', 'super_admin'), requireStoreOwnership);

router.post('/', categoryValidators, validate, categoryController.createCategory);
router.get('/', categoryController.listCategories);
router.patch('/:categoryId', categoryController.updateCategory);
router.post('/:categoryId/image', upload.single('image'), categoryController.updateCategoryImage);
router.delete('/:categoryId', categoryController.deleteCategory);

module.exports = router;
