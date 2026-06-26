const express = require('express')
const router = express.Router()
const storefrontController = require('../controllers/storefrontController')

router.get('/:storeSlug', storefrontController.getStoreBySlug)
router.get('/:storeSlug/products', storefrontController.getProducts)
router.get('/:storeSlug/products/:slugOrId', storefrontController.getProductDetail)

module.exports = router