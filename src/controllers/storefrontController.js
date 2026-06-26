const asyncHandler = require('../utils/asyncHandler')
const ApiError = require('../utils/ApiError')
const ApiResponse = require('../utils/ApiResponse')
const Store = require('../models/Store')
const Product = require('../models/Product')
const Category = require('../models/Category')

const getStoreBySlug = asyncHandler(async(req, res) => {
    const store = await Store.findOne({ slug: req.params.storeSlug, status: 'active' })
        .populate('plan', 'name limits')
    if (!store) throw ApiError.notFound('Store not found')
    const categories = await Category.find({ store: store._id, isActive: true }).sort({ name: 1 })
    return new ApiResponse(200, { store, categories }).send(res)
})

const getProducts = asyncHandler(async(req, res) => {
    const store = await Store.findOne({ slug: req.params.storeSlug, status: 'active' })
    if (!store) throw ApiError.notFound('Store not found')

    const { page = 1, limit = 12, sort = '-createdAt', category, search, featured, minPrice, maxPrice } = req.query

    const filter = { store: store._id, status: 'active' }
    if (category) filter.category = category
    if (featured === 'true') filter.isFeatured = true
    if (search) filter.$text = { $search: search }
    if (minPrice || maxPrice) {
        filter.price = {}
        if (minPrice) filter.price.$gte = Number(minPrice)
        if (maxPrice) filter.price.$lte = Number(maxPrice)
    }

    const skip = (Number(page) - 1) * Number(limit)
    const [products, total] = await Promise.all([
        Product.find(filter)
        .populate('category', 'name slug')
        .populate('brand', 'name')
        .sort(sort)
        .skip(skip)
        .limit(Number(limit))
        .select('-variants -variantOptions'),
        Product.countDocuments(filter),
    ])

    return new ApiResponse(200, products, 'Products fetched', {
        page: Number(page),
        limit: Number(limit),
        total,
        totalPages: Math.ceil(total / Number(limit)),
    }).send(res)
})

const getProductDetail = asyncHandler(async(req, res) => {
    const store = await Store.findOne({ slug: req.params.storeSlug, status: 'active' })
    if (!store) throw ApiError.notFound('Store not found')

    const { slugOrId } = req.params
    const product = await Product.findOne({
            store: store._id,
            status: 'active',
            $or: [
                { slug: slugOrId },
                ...(slugOrId.match(/^[a-fA-F0-9]{24}$/) ? [{ _id: slugOrId }] : [])
            ],
        })
        .populate('category', 'name slug')
        .populate('brand', 'name')
        .populate('relatedProducts', 'title slug images price salePrice ratings')

    if (!product) throw ApiError.notFound('Product not found')
    return new ApiResponse(200, product).send(res)
})

module.exports = { getStoreBySlug, getProducts, getProductDetail }