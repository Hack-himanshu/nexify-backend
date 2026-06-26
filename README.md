# E-Commerce SaaS Platform — Backend (Phase 1 + Phase 2)

## Phase 1 — Foundation
Database models, multi-tenancy resolution, and a complete authentication system.
See details below.

## Phase 2 — Store Owner Module (NEW)

Added in this phase:

```
src/
├── middleware/
│   ├── loadStore.js             # Loads a Store by :storeId route param → req.targetStore
│   └── upload.js                # Multer config (memory storage) for image/video uploads
├── models/
│   ├── Category.js               # Store-scoped product categories
│   ├── Brand.js                  # Store-scoped product brands
│   ├── Product.js                # Full catalog entity: variants, media, inventory, SEO
│   └── Review.js                 # Customer reviews, auto-recalculates Product.ratings
├── controllers/
│   ├── storeController.js        # Create store, settings, theme customizer, logo/favicon,
│   │                              # + Super Admin moderation (approve/reject/suspend)
│   ├── categoryController.js
│   ├── brandController.js
│   └── productController.js      # CRUD, images/videos, variant matrix, inventory, status
├── routes/
│   ├── storeRoutes.js
│   ├── categoryRoutes.js         # mounted at /stores/:storeId/categories
│   ├── brandRoutes.js            # mounted at /stores/:storeId/brands
│   ├── productRoutes.js          # mounted at /stores/:storeId/products
│   └── adminRoutes.js            # Super Admin store moderation
├── validators/
│   ├── storeValidators.js
│   └── productValidators.js
└── utils/
    └── cloudinaryUpload.js       # Buffer → Cloudinary upload/delete helper
```

### Key endpoints added

| Method | Path | Who | Purpose |
|---|---|---|---|
| POST | `/api/v1/stores` | store_owner | Create a store (wizard step 1) |
| GET | `/api/v1/stores/mine` | store_owner | List my stores |
| PATCH | `/api/v1/stores/:storeId/settings` | owner | Store name, contact, tax, shipping, currency |
| PATCH | `/api/v1/stores/:storeId/theme` | owner | Colors, fonts, header/footer, homepage builder |
| POST | `/api/v1/stores/:storeId/logo` | owner | Upload store logo (multipart) |
| POST | `/api/v1/stores/:storeId/categories` | owner | Create category |
| POST | `/api/v1/stores/:storeId/brands` | owner | Create brand |
| POST | `/api/v1/stores/:storeId/products` | owner | Create product (draft) |
| POST | `/api/v1/stores/:storeId/products/:id/images` | owner | Upload product images (multipart, up to 10) |
| PUT | `/api/v1/stores/:storeId/products/:id/variants` | owner | Set size/color variant matrix |
| PATCH | `/api/v1/stores/:storeId/products/:id/status` | owner | draft → active (requires ≥1 image) → archived |
| PATCH | `/api/v1/stores/:storeId/products/:id/inventory` | owner | Adjust stock (product or variant level) |
| GET | `/api/v1/admin/stores` | super_admin | List all stores, filter by status |
| PATCH | `/api/v1/admin/stores/:id/approve` | super_admin | Approve a pending store |

### Design notes

- Every category, brand, and product is scoped to a `store` field and verified
  to belong to that store before being attached to anything — prevents one
  store from referencing another store's catalog data via a guessed ID.
- `Product.hasVariants` + `variantOptions`/`variants` supports real size/color
  matrices (each variant has its own SKU, price, and stock), while simple
  products just use the base `price`/`sku`/`stock` fields.
- Publishing a product (`status: 'active'`) requires at least one image —
  prevents empty/broken listings from going live on the storefront.
- Image/video uploads go straight to Cloudinary from an in-memory buffer (no
  temp files on disk — important since Render's filesystem is ephemeral).

---

## Phase 1 — Backend Foundation (recap)

This establishes the architectural backbone everything else plugs into: database
models, multi-tenancy resolution, and a complete authentication system.

### What's included

```
backend/
├── server.js                      # Entry point — connects DB, starts HTTP server, graceful shutdown
├── package.json
├── .env.example                   # Copy to .env and fill in real values
└── src/
    ├── app.js                     # Express app: security middleware, route mounting
    ├── config/
    │   ├── db.js                  # MongoDB Atlas connection
    │   ├── cloudinary.js          # Cloudinary config
    │   └── passport.js            # Google OAuth strategy (optional — only loads if configured)
    ├── models/
    │   ├── User.js                # Super Admin / Store Owner / Customer, tenant-scoped
    │   ├── Store.js                # Core multi-tenant entity (theme, plan, status, subdomain)
    │   ├── Plan.js                 # Subscription tiers
    │   └── RefreshToken.js         # Hashed refresh tokens with TTL auto-expiry
    ├── middleware/
    │   ├── auth.js                 # protect, authorize(roles), requireStoreOwnership, optionalAuth
    │   ├── tenantResolver.js       # Resolves Store from subdomain/custom domain/header
    │   ├── errorHandler.js         # Centralized error normalization
    │   ├── validate.js             # express-validator result handler
    │   └── rateLimiter.js          # General + strict auth rate limits
    ├── controllers/authController.js
    ├── routes/authRoutes.js
    ├── validators/authValidators.js
    ├── services/emailService.js    # Nodemailer transactional emails
    ├── utils/
    │   ├── ApiError.js / ApiResponse.js / asyncHandler.js
    │   └── tokenService.js         # JWT access tokens + rotating refresh tokens
    └── seeders/index.js            # Seeds default Plans + first Super Admin
```

## How multi-tenancy works here

- Every `Store` document is the tenant boundary. `User` documents for customers carry a
  `store` field; platform-level users (`super_admin`, `store_owner`) have `store: null`.
- A compound index `{ email, store }` means the same email can be a customer of multiple
  stores with independent accounts (matches Shopify's per-store customer account model),
  while platform accounts stay globally unique.
- `resolveTenant` (strict) is for storefront browsing routes — it 404s if no store matches
  the subdomain/custom domain. `tryResolveTenant` (lenient) is used on the shared auth
  routes so the same `/auth/register` endpoint works for both platform sign-ups and
  store-scoped customer sign-ups without forcing a tenant.

## Auth system

- Password auth (bcrypt, cost factor 12) + Google OAuth (optional, set env vars to enable).
- Short-lived (15 min) JWT access tokens, sent as httpOnly cookies (also accepted via
  `Authorization: Bearer`).
- Refresh tokens are opaque random values; only their SHA-256 hash is stored in MongoDB,
  with rotation on every refresh and a TTL index for automatic cleanup.
- `forgot-password` always returns a generic success message to prevent user enumeration.
- `logout-all` revokes every active session (all devices) for a user.

## Running locally

```bash
cd backend
cp .env.example .env   # fill in MONGO_URI, JWT secrets, etc.
npm install
npm run seed            # creates default Plans + the first Super Admin
npm run dev              # starts on http://localhost:5000
```

Health check: `GET http://localhost:5000/health`

## What's NOT in this phase yet

Cart/checkout, orders, customer-facing storefront browsing, theme rendering, payments,
marketing (coupons/flash sales), SEO endpoints, analytics, and the entire React frontend.
These come in subsequent phases.

