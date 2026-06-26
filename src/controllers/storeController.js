const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const ApiResponse = require('../utils/ApiResponse');
const Store = require('../models/Store');
const Plan = require('../models/Plan');
const User = require('../models/User');
const { uploadBufferToCloudinary, deleteFromCloudinary } = require('../utils/cloudinaryUpload');

/**
 * POST /api/v1/stores
 * Step 1 of the "Create Store" wizard. Only store_owner role can create stores.
 * New stores start on the default (free) plan and in pending_approval status —
 * a Super Admin approves before the store goes live (per the platform's
 * Store Approval feature).
 */
const createStore = asyncHandler(async(req, res) => {
    const { name, category, description, currency } = req.body;

    const defaultPlan = await Plan.findOne({ isDefault: true, isActive: true });
    if (!defaultPlan) {
        throw ApiError.internal('No default plan configured. Contact platform support.');
    }

    const store = await Store.create({
        owner: req.user._id,
        name,
        category,
        description: description || '',
        currency: currency || 'INR',
        plan: defaultPlan._id,
        status: 'active',
        subscriptionStatus: defaultPlan.trialDays > 0 ? 'trialing' : 'active',
        subscriptionExpiresAt: defaultPlan.trialDays > 0 ?
            new Date(Date.now() + defaultPlan.trialDays * 24 * 60 * 60 * 1000) : null,
    });

    await User.findByIdAndUpdate(req.user._id, { $addToSet: { ownedStores: store._id } });

    return new ApiResponse(
        201,
        store,
        'Store created successfully. It will go live once approved by the platform.'
    ).send(res);
});

/**
 * GET /api/v1/stores/mine
 * Lists every store owned by the authenticated store_owner.
 */
const getMyStores = asyncHandler(async(req, res) => {
    const stores = await Store.find({ owner: req.user._id }).populate('plan');
    return new ApiResponse(200, stores).send(res);
});

/**
 * GET /api/v1/stores/:storeId
 * Accessible to the owning store_owner or a super_admin. (requireStoreOwnership
 * middleware already enforced this before reaching here — see storeRoutes.)
 */
const getStoreById = asyncHandler(async(req, res) => {
    const store = await Store.findById(req.params.storeId).populate('plan').populate('owner', 'name email');
    if (!store) throw ApiError.notFound('Store not found');
    return new ApiResponse(200, store).send(res);
});

/**
 * PATCH /api/v1/stores/:storeId/settings
 * Updates general store settings: name, description, contact, currency, tax, shipping.
 * Custom domain changes are gated by the store's plan.
 */
const updateStoreSettings = asyncHandler(async(req, res) => {
    const store = req.targetStore; // attached by loadStore middleware
    const allowedFields = [
        'name',
        'description',
        'contact',
        'currency',
        'tax',
        'shipping',
        'seo',
    ];

    for (const field of allowedFields) {
        if (req.body[field] !== undefined) {
            store[field] = req.body[field];
        }
    }

    if (req.body.customDomain !== undefined) {
        const plan = await Plan.findById(store.plan);
        if (!plan ?.limits ?.customDomainAllowed) {
            throw ApiError.forbidden('Your current plan does not support custom domains. Please upgrade.');
        }
        store.customDomain = req.body.customDomain || null;
    }

    await store.save();
    return new ApiResponse(200, store, 'Store settings updated').send(res);
});

/**
 * PATCH /api/v1/stores/:storeId/theme
 * Theme customizer: colors, fonts, header/footer config, homepage section builder.
 */
const updateStoreTheme = asyncHandler(async(req, res) => {
    const store = req.targetStore;
    const { templateId, colors, fonts, header, footer, homepageSections } = req.body;

    if (templateId !== undefined) store.theme.templateId = templateId;
    if (colors !== undefined) store.theme.colors = {...store.theme.colors.toObject ?.() ?? store.theme.colors, ...colors };
    if (fonts !== undefined) store.theme.fonts = {...store.theme.fonts.toObject ?.() ?? store.theme.fonts, ...fonts };
    if (header !== undefined) store.theme.header = header;
    if (footer !== undefined) store.theme.footer = footer;
    if (homepageSections !== undefined) store.theme.homepageSections = homepageSections;

    store.markModified('theme');
    await store.save();

    return new ApiResponse(200, store.theme, 'Theme updated').send(res);
});

/**
 * POST /api/v1/stores/:storeId/logo
 * multipart/form-data, field name "logo" (handled by upload middleware in routes)
 */
const updateStoreLogo = asyncHandler(async(req, res) => {
    const store = req.targetStore;
    if (!req.file) throw ApiError.badRequest('No file uploaded');

    if (store.logo ?.publicId) {
        await deleteFromCloudinary(store.logo.publicId);
    }

    const result = await uploadBufferToCloudinary(req.file.buffer, {
        folder: `stores/${store.slug}/branding`,
    });

    store.logo = result;
    await store.save();

    return new ApiResponse(200, store.logo, 'Logo updated').send(res);
});

/**
 * POST /api/v1/stores/:storeId/favicon
 */
const updateStoreFavicon = asyncHandler(async(req, res) => {
    const store = req.targetStore;
    if (!req.file) throw ApiError.badRequest('No file uploaded');

    if (store.favicon ?.publicId) {
        await deleteFromCloudinary(store.favicon.publicId);
    }

    const result = await uploadBufferToCloudinary(req.file.buffer, {
        folder: `stores/${store.slug}/branding`,
    });

    store.favicon = result;
    await store.save();

    return new ApiResponse(200, store.favicon, 'Favicon updated').send(res);
});

/**
 * POST /api/v1/stores/:storeId/complete-onboarding
 * Marks the creation wizard as finished so the dashboard can stop showing it.
 */
const completeOnboarding = asyncHandler(async(req, res) => {
    const store = req.targetStore;
    store.isOnboardingComplete = true;
    await store.save();
    return new ApiResponse(200, store, 'Onboarding complete').send(res);
});

// ---------------------------------------------------------------------------
// SUPER ADMIN ACTIONS
// ---------------------------------------------------------------------------

/**
 * GET /api/v1/admin/stores
 * Lists all stores on the platform with filtering by status.
 */
const adminListStores = asyncHandler(async(req, res) => {
    const { status, page = 1, limit = 20 } = req.query;
    const filter = {};
    if (status) filter.status = status;

    const skip = (Number(page) - 1) * Number(limit);
    const [stores, total] = await Promise.all([
        Store.find(filter)
        .populate('owner', 'name email')
        .populate('plan', 'name')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit)),
        Store.countDocuments(filter),
    ]);

    return new ApiResponse(200, stores, 'Stores fetched', {
        page: Number(page),
        limit: Number(limit),
        total,
        totalPages: Math.ceil(total / Number(limit)),
    }).send(res);
});

/**
 * PATCH /api/v1/admin/stores/:storeId/approve
 */
const adminApproveStore = asyncHandler(async(req, res) => {
    const store = await Store.findById(req.params.storeId);
    if (!store) throw ApiError.notFound('Store not found');

    store.status = 'active';
    store.suspensionReason = '';
    await store.save();

    return new ApiResponse(200, store, 'Store approved and is now live').send(res);
});

/**
 * PATCH /api/v1/admin/stores/:storeId/reject
 */
const adminRejectStore = asyncHandler(async(req, res) => {
    const { reason } = req.body;
    const store = await Store.findById(req.params.storeId);
    if (!store) throw ApiError.notFound('Store not found');

    store.status = 'rejected';
    store.suspensionReason = reason || '';
    await store.save();

    return new ApiResponse(200, store, 'Store rejected').send(res);
});

/**
 * PATCH /api/v1/admin/stores/:storeId/suspend
 */
const adminSuspendStore = asyncHandler(async(req, res) => {
    const { reason } = req.body;
    const store = await Store.findById(req.params.storeId);
    if (!store) throw ApiError.notFound('Store not found');

    store.status = 'suspended';
    store.suspensionReason = reason || 'Violation of platform policies';
    await store.save();

    return new ApiResponse(200, store, 'Store suspended').send(res);
});

/**
 * PATCH /api/v1/admin/stores/:storeId/reactivate
 */
const adminReactivateStore = asyncHandler(async(req, res) => {
    const store = await Store.findById(req.params.storeId);
    if (!store) throw ApiError.notFound('Store not found');

    store.status = 'active';
    store.suspensionReason = '';
    await store.save();

    return new ApiResponse(200, store, 'Store reactivated').send(res);
});

module.exports = {
    createStore,
    getMyStores,
    getStoreById,
    updateStoreSettings,
    updateStoreTheme,
    updateStoreLogo,
    updateStoreFavicon,
    completeOnboarding,
    adminListStores,
    adminApproveStore,
    adminRejectStore,
    adminSuspendStore,
    adminReactivateStore,
};


