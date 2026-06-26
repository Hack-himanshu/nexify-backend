const mongoose = require('mongoose');
const slugify = require('slugify');

const storeSchema = new mongoose.Schema({
    owner: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true,
    },
    name: {
        type: String,
        required: [true, 'Store name is required'],
        trim: true,
        maxlength: 100,
    },
    // Used to build subdomain: {slug}.platform.com
    slug: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true,
        index: true,
    },
    customDomain: {
        type: String,
        default: null,
        sparse: true,
        lowercase: true,
        trim: true,
    },
    category: {
        type: String,
        enum: [
            'fashion',
            'electronics',
            'grocery',
            'furniture',
            'cosmetics',
            'jewelry',
            'books',
            'sports',
            'custom',
        ],
        required: true,
    },
    description: {
        type: String,
        maxlength: 1000,
        default: '',
    },
    logo: {
        url: { type: String, default: '' },
        publicId: { type: String, default: '' },
    },
    favicon: {
        url: { type: String, default: '' },
        publicId: { type: String, default: '' },
    },
    contact: {
        email: { type: String, default: '' },
        phone: { type: String, default: '' },
        address: { type: String, default: '' },
    },
    currency: {
        type: String,
        default: 'INR',
    },
    tax: {
        isInclusive: { type: Boolean, default: true },
        defaultRatePercent: { type: Number, default: 0, min: 0, max: 100 },
    },
    shipping: {
        freeShippingThreshold: { type: Number, default: null },
        flatRate: { type: Number, default: 0 },
        zones: [{
            name: String,
            countries: [String],
            rate: Number,
        }, ],
    },
    theme: {
        templateId: { type: String, default: 'default' },
        colors: {
            primary: { type: String, default: '#111827' },
            secondary: { type: String, default: '#6366F1' },
            background: { type: String, default: '#FFFFFF' },
            text: { type: String, default: '#111827' },
        },
        fonts: {
            heading: { type: String, default: 'Inter' },
            body: { type: String, default: 'Inter' },
        },
        header: {
            type: mongoose.Schema.Types.Mixed,
            default: {},
        },
        footer: {
            type: mongoose.Schema.Types.Mixed,
            default: {},
        },
        homepageSections: {
            type: [mongoose.Schema.Types.Mixed],
            default: [],
        },
    },
    plan: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Plan',
        required: true,
    },
    subscriptionStatus: {
        type: String,
        enum: ['trialing', 'active', 'past_due', 'canceled'],
        default: 'trialing',
    },
    subscriptionExpiresAt: {
        type: Date,
    },
    status: {
        type: String,
        enum: ['pending_approval', 'active', 'suspended', 'rejected'],
        default: 'pending_approval',
        index: true,
    },
    suspensionReason: {
        type: String,
        default: '',
    },
    seo: {
        metaTitle: { type: String, default: '' },
        metaDescription: { type: String, default: '' },
        ogImage: { type: String, default: '' },
    },
    isOnboardingComplete: {
        type: Boolean,
        default: false,
    },
}, { timestamps: true });

storeSchema.pre('validate', function generateSlug(next) {
    if (this.name && (!this.slug || this.isModified('name'))) {
        this.slug = slugify(this.name, { lower: true, strict: true });
    }
    next();
});

storeSchema.index({ name: 'text', description: 'text' });

module.exports = mongoose.model('Store', storeSchema);